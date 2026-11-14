'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../lib/store');
const { bootstrap } = require('../lib/bootstrap');
const { load } = require('../lib/config');
const files = require('../lib/files');

let server, base, store, admin, res, pending, resId;
const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sync = (token, changes) => call('POST', '/api/sync', { changes }, token);
const up = (...docs) => ({ upsert: docs });
const b64 = b => Buffer.from(b).toString('base64');
const PDF = b64('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = b64(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]));

test.before(async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'y'.repeat(40), CLIENT_ORIGINS: 'https://app.example.com' });
  store = new MemoryStore();
  await bootstrap(store, config, { log() {} });
  server = createApp({ store, config });
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
  admin = (await call('POST', '/api/auth/login', { id: 'admin', password: 'adminpass1' })).body.token;
  const reg = async (name, mobile, flat) => (await call('POST', '/api/auth/register', { name, mobile, tower: 'A', flat, type: 'Owner', password: 'secret123', members: 1 })).body;
  const r1 = await reg('Priya Nair', '9876500011', '101'); res = r1.token; resId = r1.session.id;
  pending = (await reg('Waiting Person', '9876500012', '102')).token;
  await sync(admin, { users: up({ id: resId, status: 'approved' }) });
});
test.after(() => server.close());

let pdf, png;

test('only the admin can upload, and only real PDFs and images pass', async () => {
  assert.equal((await call('POST', '/api/files', { name: 'a.pdf', data: PDF })).status, 401);
  assert.equal((await call('POST', '/api/files', { name: 'a.pdf', data: PDF }, res)).status, 403);
  const ok = await call('POST', '/api/files', { name: 'Water tank notice.pdf', data: PDF }, admin);
  assert.equal(ok.status, 201); pdf = ok.body.file;
  assert.equal(pdf.mime, 'application/pdf'); assert.ok(pdf.size > 10);
  png = (await call('POST', '/api/files', { name: 'poster.PNG', data: PNG }, admin)).body.file;
  assert.equal(png.mime, 'image/png');
  assert.equal((await call('POST', '/api/files', { name: 'virus.exe', data: PDF }, admin)).status, 400, 'type not allowed');
  assert.equal((await call('POST', '/api/files', { name: 'fake.pdf', data: PNG }, admin)).status, 400, 'bytes must match the extension');
  assert.equal((await call('POST', '/api/files', { name: 'x.pdf', data: 'not base64!!' }, admin)).status, 400);
  assert.equal((await call('POST', '/api/files', { name: 'x.pdf', data: '' }, admin)).status, 400);
  const big = b64(Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(files.FILE_MAX)]));
  assert.equal((await call('POST', '/api/files', { name: 'big.pdf', data: big }, admin)).status, 413);
});

test('notices and events keep only a small attachment description', async () => {
  const r = await sync(admin, {
    notices: up({ id: 'n1', title: 'Tank cleaning', body: 'x', category: 'Maintenance', priority: 'normal', pinned: false, date: new Date().toISOString(), author: 'Office', readBy: [], attachment: { ...pdf, data: 'SHOULD NOT STAY', extra: 1 } }),
    events: up({ id: 'e1', title: 'Annual Day', date: new Date(Date.now() + 5 * 864e5).toISOString(), venue: 'Hall', category: 'Cultural', fee: 0, desc: '', scene: 'night', featured: true, rsvps: {}, attachment: { id: '../../etc', name: 'x', mime: 'application/pdf', size: 5 } })
  });
  assert.equal(r.body.rejected.length, 0);
  const s = (await call('GET', '/api/state', null, res)).body.db;
  assert.deepEqual(Object.keys(s.notices[0].attachment).sort(), ['id', 'mime', 'name', 'size']);
  assert.equal(s.notices[0].attachment.id, pdf.id);
  assert.equal(s.events[0].attachment, null, 'a bad id is dropped');
  const w = await sync(res, { notices: up({ id: 'n1', title: 'x', attachment: { ...png } }) });
  assert.equal(s.notices[0].attachment.id, pdf.id);
  const again = (await call('GET', '/api/state', null, res)).body.db;
  assert.equal(again.notices[0].attachment.id, pdf.id, 'a resident cannot swap the attachment');
  assert.ok(w.status === 200);
});

test('residents get a signed link; it serves the right bytes and headers', async () => {
  assert.equal((await call('POST', `/api/files/${pdf.id}/link`)).status, 401);
  assert.equal((await call('POST', `/api/files/${pdf.id}/link`, null, pending)).status, 403, 'pending residents get nothing');
  assert.equal((await call('POST', '/api/files/fnope/link', null, res)).status, 404);
  const l = await call('POST', `/api/files/${pdf.id}/link`, null, res);
  assert.equal(l.status, 200); assert.equal(l.body.inline, true);
  const inline = await fetch(base + l.body.url);
  assert.equal(inline.status, 200);
  assert.equal(inline.headers.get('content-type'), 'application/pdf');
  assert.match(inline.headers.get('content-disposition'), /^inline;/);
  assert.equal(inline.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(Buffer.from(await inline.arrayBuffer()).toString('base64'), PDF);
  const dl = await fetch(base + l.body.url + '&dl=1');
  assert.match(dl.headers.get('content-disposition'), /^attachment;.*Water tank notice\.pdf/);
});

test('links are tied to one file and cannot be forged', async () => {
  const l = (await call('POST', `/api/files/${pdf.id}/link`, null, res)).body;
  const t = new URL(base + l.url).searchParams.get('t');
  assert.equal((await fetch(`${base}/api/files/${png.id}?t=${t}`)).status, 403, 'token for another file');
  assert.equal((await fetch(`${base}/api/files/${pdf.id}`)).status, 403, 'no token');
  assert.equal((await fetch(`${base}/api/files/${pdf.id}?t=${t}x`)).status, 403, 'tampered token');
});

test('public view never carries attachments; unused files are swept', async () => {
  const pub = (await call('GET', '/api/public')).body.db;
  assert.ok(pub.events.every(e => e.attachment === undefined));
  assert.equal(pub.notices.length, 0);
  // the png was never attached anywhere: not swept while fresh, swept once old
  assert.ok(await store.get('files', png.id));
  assert.equal(await files.sweep(store, Date.now()), 0);
  assert.equal(await files.sweep(store, Date.now() + files.GRACE_MS + 1000), 1);
  assert.equal(await store.get('files', png.id), null);
  assert.equal(await store.get('fdata', png.id), null);
  // removing the notice frees the pdf on the next admin sync of notices
  await store.put('files', { ...(await store.get('files', pdf.id)), at: Date.now() - files.GRACE_MS - 1000 });
  await sync(admin, { notices: { remove: ['n1'] } });
  assert.equal(await store.get('files', pdf.id), null);
});
