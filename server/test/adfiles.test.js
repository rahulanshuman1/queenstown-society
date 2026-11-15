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
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.9.0.' + (ip++ & 255), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sync = (t, changes) => call('POST', '/api/sync', { changes }, t);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(40)]).toString('base64');
const resident = async (mobile, flat) => {
  const r = await call('POST', '/api/auth/register', { name: 'Ad Resident', mobile, tower: 'A', flat, type: 'Tenant', password: 'secret123' });
  await sync(admin, { users: { upsert: [{ id: r.body.session.id, status: 'approved' }] } });
  return { id: r.body.session.id, token: r.body.token };
};
const ad = (id, o = {}) => ({ id, type: 'classified', title: 'Tuition', body: 'Maths', category: 'Tuition', contact: '9999999999', ...o });

test.before(async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'z'.repeat(40), CLIENT_ORIGINS: 'https://app.example.com' });
  store = new MemoryStore(); await bootstrap(store, config, { log() {} });
  server = createApp({ store, config }); await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
  admin = (await call('POST', '/api/auth/login', { id: 'admin', password: 'adminpass1' })).body.token;
});
test.after(() => server.close());

test('a resident can upload a file for an ad and it is kept on the ad', async () => {
  const r = await resident('9876540001', '101');
  const up = await call('POST', '/api/files', { name: 'flyer.png', data: PNG }, r.token);
  assert.equal(up.status, 201);
  const meta = await store.get('files', up.body.file.id);
  assert.equal(meta.kind, 'ad'); assert.equal(meta.owner, r.id);
  assert.equal((await sync(r.token, { ads: { upsert: [ad('a1', { attachment: up.body.file })] } })).status, 200);
  const stored = await store.get('ads', 'a1');
  assert.equal(stored.attachment.name, 'flyer.png'); assert.equal(stored.attachment.mime, 'image/png');
  assert.equal(stored.status, 'pending');
  // the admin and a neighbour (once live) can open it
  assert.equal((await call('POST', '/api/files/' + up.body.file.id + '/link', null, admin)).status, 200);
});

test('a resident cannot attach someone else\'s file, and bad files are refused', async () => {
  const a = await resident('9876540002', '102'), b = await resident('9876540003', '103');
  const up = await call('POST', '/api/files', { name: 'mine.png', data: PNG }, a.token);
  await sync(b.token, { ads: { upsert: [ad('a2', { attachment: up.body.file })] } });
  assert.equal((await store.get('ads', 'a2')).attachment, null, 'not b\'s file');
  const adminFile = (await call('POST', '/api/files', { name: 'notice.png', data: PNG }, admin)).body.file;
  await sync(b.token, { ads: { upsert: [ad('a3', { attachment: adminFile })] } });
  assert.equal((await store.get('ads', 'a3')).attachment, null, 'not an admin file');
  assert.equal((await call('POST', '/api/files', { name: 'x.png', data: Buffer.from('nope').toString('base64') }, a.token)).status, 400);
  assert.equal((await call('POST', '/api/files', { name: 'x.exe', data: PNG }, a.token)).status, 400);
});

test('upload is for approved residents only, with a limit', async () => {
  const pend = await call('POST', '/api/auth/register', { name: 'Pending One', mobile: '9876540010', tower: 'B', flat: '101', type: 'Tenant', password: 'secret123' });
  assert.equal((await call('POST', '/api/files', { name: 'a.png', data: PNG }, pend.body.token)).status, 403);
  const r = await resident('9876540011', '104');
  let last;
  for (let i = 0; i < 13; i++) last = await call('POST', '/api/files', { name: 'a.png', data: PNG }, r.token);
  assert.equal(last.status, 429);
});

test('ad files stay while the ad exists and are cleaned up after it is removed', async () => {
  const r = await resident('9876540020', '201');
  const f = (await call('POST', '/api/files', { name: 'f.png', data: PNG }, r.token)).body.file;
  await sync(r.token, { ads: { upsert: [ad('a9', { attachment: f })] } });
  const later = Date.now() + files.GRACE_MS + 1000;
  await files.sweep(store, later);
  assert.ok(await store.get('files', f.id), 'used by the ad');
  await sync(r.token, { ads: { remove: ['a9'] } });
  await files.sweep(store, later);
  assert.equal(await store.get('files', f.id), null);
});

test('the owner of a banner ad can send a payment reference, and only that changes', async () => {
  const a = await resident('9876540030', '301'), b = await resident('9876540031', '302');
  await sync(a.token, { ads: { upsert: [ad('b1', { type: 'banner', weeks: 2 })] } });
  const fee = (await store.get('ads', 'b1')).fee;
  assert.ok(fee > 0);
  await sync(b.token, { ads: { upsert: [{ ...(await store.get('ads', 'b1')), feeRef: 'HACK' }] } });
  assert.equal((await store.get('ads', 'b1')).feeRef, undefined, 'not the owner');
  await sync(a.token, { ads: { upsert: [{ ...(await store.get('ads', 'b1')), title: 'Changed', fee: 1, feePaid: true, status: 'live', feeRef: 'UTR123', feeMethod: 'Bank transfer' }] } });
  const x = await store.get('ads', 'b1');
  assert.equal(x.feeRef, 'UTR123'); assert.equal(x.feeMethod, 'Bank transfer');
  assert.equal(x.title, 'Tuition'); assert.equal(x.fee, fee); assert.equal(x.feePaid, false); assert.equal(x.status, 'pending');
  // admin confirms
  await sync(admin, { ads: { upsert: [{ ...x, feePaid: true }] } });
  assert.equal((await store.get('ads', 'b1')).feePaid, true);
  // once paid, the owner can no longer change the reference
  await sync(a.token, { ads: { upsert: [{ ...(await store.get('ads', 'b1')), feeRef: 'LATER' }] } });
  assert.equal((await store.get('ads', 'b1')).feeRef, 'UTR123');
});
