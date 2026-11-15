'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../lib/store');
const { bootstrap } = require('../lib/bootstrap');
const { load } = require('../lib/config');
const files = require('../lib/files');

let server, base, store, admin, ip = 0;
const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.8.0.' + (ip++ & 255), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sync = (t, changes) => call('POST', '/api/sync', { changes }, t);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(40)]).toString('base64');
const resident = async (mobile, flat) => {
  const r = await call('POST', '/api/auth/register', { name: 'Book Resident', mobile, tower: 'A', flat, type: 'Tenant', password: 'secret123' });
  await sync(admin, { users: { upsert: [{ id: r.body.session.id, status: 'approved' }] } });
  return { id: r.body.session.id, token: r.body.token };
};
const day = n => { const d = new Date(Date.now() + n * 86400e3); d.setHours(0, 0, 0, 0); return d.toISOString(); };

test.before(async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'z'.repeat(40), CLIENT_ORIGINS: 'https://app.example.com' });
  store = new MemoryStore(); await bootstrap(store, config, { log() {} });
  server = createApp({ store, config }); await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
  admin = (await call('POST', '/api/auth/login', { id: 'admin', password: 'adminpass1' })).body.token;
});
test.after(() => server.close());

test('the server sets the booking fee from the amenity rate and the owner can send a payment reference', async () => {
  const r = await resident('9876550001', '101');
  const paid = (await store.all('amenities')).find(a => a.rate > 0), free = (await store.all('amenities')).find(a => !(a.rate > 0));
  await sync(r.token, { bookings: { upsert: [{ id: 'k1', amenityId: paid.id, date: day(5), slot: 'Evening', purpose: 'Party', fee: 1, feePaid: true }] } });
  let b = await store.get('bookings', 'k1');
  assert.equal(b.fee, paid.rate); assert.equal(b.feePaid, false);
  if (free) { await sync(r.token, { bookings: { upsert: [{ id: 'k2', amenityId: free.id, date: day(6), slot: 'Evening', purpose: 'Meet' }] } }); assert.equal((await store.get('bookings', 'k2')).feePaid, true); }
  await sync(r.token, { bookings: { upsert: [{ id: 'k1', feeRef: 'UTR123456789', feeMethod: 'UPI', feePaid: true, status: 'approved', fee: 0 }] } });
  b = await store.get('bookings', 'k1');
  assert.equal(b.feeRef, 'UTR123456789'); assert.equal(b.feePaid, false); assert.equal(b.status, 'pending'); assert.equal(b.fee, paid.rate);
  await sync(admin, { bookings: { upsert: [{ ...b, feePaid: true }] } });
  assert.equal((await store.get('bookings', 'k1')).feePaid, true);
  // once paid, a resident cannot change it again
  await sync(r.token, { bookings: { upsert: [{ id: 'k1', feeRef: 'OTHER' }] } });
  assert.equal((await store.get('bookings', 'k1')).feeRef, 'UTR123456789');
});

test('another resident cannot send a reference for someone else\'s booking', async () => {
  const a = await resident('9876550002', '102'), o = await resident('9876550003', '103');
  const paid = (await store.all('amenities')).find(x => x.rate > 0);
  await sync(a.token, { bookings: { upsert: [{ id: 'k3', amenityId: paid.id, date: day(8), slot: 'Night', purpose: 'X' }] } });
  await sync(o.token, { bookings: { upsert: [{ id: 'k3', feeRef: 'HACK' }] } });
  assert.equal((await store.get('bookings', 'k3')).feeRef, undefined);
});

test('the admin can add a file to a document and it is kept; a resident cannot add documents', async () => {
  const f = (await call('POST', '/api/files', { name: 'bylaws.png', data: PNG }, admin)).body.file;
  await sync(admin, { docs: { upsert: [{ id: 'd1', title: 'Bye-laws', type: 'Bye-laws', date: new Date().toISOString(), desc: 'x', attachment: f }] } });
  assert.equal((await store.get('docs', 'd1')).attachment.name, 'bylaws.png');
  await sync(admin, { docs: { upsert: [{ id: 'd2', title: 'Fake', type: 'Forms', desc: 'x', attachment: { id: 'f' + 'a'.repeat(20), name: 'x.pdf', mime: 'application/pdf', size: 1 } }] } });
  assert.equal((await store.get('docs', 'd2')).attachment, null, 'unknown file is dropped');
  const r = await resident('9876550004', '104');
  await sync(r.token, { docs: { upsert: [{ id: 'd3', title: 'Nope', type: 'Forms', desc: 'x' }] } });
  assert.equal(await store.get('docs', 'd3'), null);
  // sweep keeps a file used by a document
  await files.sweep(store, Date.now() + 3 * 3600e3);
  assert.ok(await store.get('files', f.id));
});
