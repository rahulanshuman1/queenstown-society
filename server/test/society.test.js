'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../lib/store');
const { bootstrap } = require('../lib/bootstrap');
const { load } = require('../lib/config');
const files = require('../lib/files');

let server, base, store, admin, n = 0;
// each call comes from its own address so the registration rate limit (10 an hour per address) does not get in the way
const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.' + (n >> 8) + '.' + (n++ & 255), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sync = (t, changes) => call('POST', '/api/sync', { changes }, t);
const up = (...d) => ({ upsert: d });
const b64 = b => Buffer.from(b).toString('base64');
const PDF = b64('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const reg = (o = {}) => call('POST', '/api/auth/register', { name: 'Priya Nair', mobile: '9876500001', tower: 'A', flat: '101', type: 'Owner', password: 'secret123', members: 2, ...o });
const siteWith = towers => ({ settings: { upsert: [{ id: 'settings', site: { towers } }] } });

test.before(async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'z'.repeat(40), CLIENT_ORIGINS: 'https://app.example.com' });
  store = new MemoryStore();
  await bootstrap(store, config, { log() {} });
  server = createApp({ store, config });
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
  admin = (await call('POST', '/api/auth/login', { id: 'admin', password: 'adminpass1' })).body.token;
});
test.after(() => server.close());

test('towers and flats default to A to D until the admin changes them', async () => {
  const s = (await call('GET', '/api/public')).body.db.settings;
  assert.equal(s.site, undefined, 'nothing saved yet, the app uses its built in default');
  assert.equal((await reg({ tower: 'Z', flat: '101' })).status, 400, 'unknown tower');
  assert.equal((await reg({ tower: 'A', flat: '999' })).status, 400, 'unknown flat');
});

test('admin adds a tower and flats in Site studio; residents can then register there', async () => {
  assert.equal((await reg({ tower: 'E', flat: 'G01', mobile: '9876500020' })).status, 400, 'not added yet');
  const towers = [{ code: 'a', name: 'Tower A', flats: ['101', '102'] }, { code: 'E', name: 'Eden Wing', flats: ['g01', '101', '101', 'bad flat!'] }];
  const r = await call('POST', '/api/sync', { changes: siteWith(towers) }, admin);
  assert.equal(r.status, 200);
  const site = (await call('GET', '/api/public')).body.db.settings.site;
  assert.deepEqual(site.towers.map(t => t.code), ['A', 'E']);
  assert.deepEqual(site.towers[1].flats, ['101', 'G01'], 'upper-cased, de-duplicated, bad names dropped');
  assert.equal((await reg({ tower: 'E', flat: 'g01', mobile: '9876500021' })).status, 201);
  assert.equal((await reg({ tower: 'A', flat: '103', mobile: '9876500022' })).status, 400, 'flat removed from tower A');
  assert.equal((await reg({ tower: 'B', flat: '101', mobile: '9876500023' })).status, 400, 'tower B removed');
});

test('a resident cannot change towers; an empty list falls back to the default', async () => {
  const r = await reg({ tower: 'A', flat: '102', mobile: '9876500024' });
  assert.equal(r.status, 201);
  await sync(admin, { users: up({ id: r.body.session.id, status: 'approved' }) });
  await sync(r.body.token, siteWith([{ code: 'Q', name: 'x', flats: ['1'] }]));
  assert.deepEqual((await call('GET', '/api/public')).body.db.settings.site.towers.map(t => t.code), ['A', 'E']);
  await call('POST', '/api/sync', { changes: siteWith([]) }, admin);
  assert.equal((await call('GET', '/api/public')).body.db.settings.site.towers.length, 4);
});

test('registration keeps intercom, company, designation and a private proof file', async () => {
  const r = await reg({ mobile: '9876500031', tower: 'B', flat: '202', intercom: '2041<script>', company: 'Acme Ltd', designation: 'Engineer', proof: { name: 'allotment.pdf', data: PDF } });
  assert.equal(r.status, 201);
  const me = (await call('GET', '/api/state', null, r.body.token)).body.db.users[0];
  assert.equal(me.intercom, '2041script');
  assert.equal(me.company, 'Acme Ltd');
  assert.equal(me.designation, 'Engineer');
  assert.equal(me.proof.name, 'allotment.pdf');
  assert.equal(me.proof.mime, 'application/pdf');
  assert.equal(me.proof.data, undefined, 'the bytes are never part of the user record');

  // the admin can open it
  const link = await call('POST', '/api/files/' + me.proof.id + '/link', null, admin);
  assert.equal(link.status, 200);
  const got = await fetch(base + link.body.url);
  assert.equal(got.status, 200);
  assert.equal(Buffer.from(await got.arrayBuffer()).toString('latin1').slice(0, 5), '%PDF-');

  // another approved resident cannot
  const o = await reg({ mobile: '9876500032', tower: 'B', flat: '203' });
  await sync(admin, { users: up({ id: o.body.session.id, status: 'approved' }, { id: r.body.session.id, status: 'approved' }) });
  assert.equal((await call('POST', '/api/files/' + me.proof.id + '/link', null, o.body.token)).status, 403);
  // the owner of the proof can
  assert.equal((await call('POST', '/api/files/' + me.proof.id + '/link', null, r.body.token)).status, 200);

  // directory: neighbours see the intercom, not company, designation or proof
  const dir = (await call('GET', '/api/state', null, o.body.token)).body.db.users.find(u => u.id === r.body.session.id);
  assert.equal(dir.intercom, '2041script');
  assert.equal(dir.company, undefined);
  assert.equal(dir.designation, undefined);
  assert.equal(dir.proof, undefined);
});

test('bad proof files are refused and no account is left behind', async () => {
  const before = (await store.all('users')).length;
  assert.equal((await reg({ mobile: '9876500041', proof: { name: 'x.pdf', data: b64('not a pdf') } })).status, 400);
  assert.equal((await reg({ mobile: '9876500041', proof: { name: 'x.exe', data: PDF } })).status, 400);
  assert.equal((await store.all('users')).length, before);
  const big = b64(Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(files.FILE_MAX + 10)]));
  assert.equal((await reg({ mobile: '9876500041', proof: { name: 'big.pdf', data: big } })).status, 413);
});

test('proof files survive the clean-up while the resident exists, and go once they are removed', async () => {
  const r = await reg({ mobile: '9876500051', tower: 'C', flat: '301', proof: { name: 'p.pdf', data: PDF } });
  const id = (await store.get('users', r.body.session.id)).proof.id;
  const old = Date.now() + files.GRACE_MS + 1000;
  await files.sweep(store, old);
  assert.ok(await store.get('files', id), 'still used by the resident');
  await sync(admin, { users: { remove: [r.body.session.id] } });
  await files.sweep(store, old);
  assert.equal(await store.get('files', id), null);
});

test('residents edit their own intercom, company and designation; admin can too', async () => {
  const r = await reg({ mobile: '9876500061', tower: 'D', flat: '401' });
  await sync(admin, { users: up({ id: r.body.session.id, status: 'approved' }) });
  const id = r.body.session.id;
  await sync(r.body.token, { users: up({ id, intercom: ' 4010 ', company: 'Beta', designation: 'Doctor' }) });
  let u = await store.get('users', id);
  assert.deepEqual([u.intercom, u.company, u.designation], ['4010', 'Beta', 'Doctor']);
  await sync(admin, { users: up({ id, intercom: '4011' }) });
  assert.equal((await store.get('users', id)).intercom, '4011');
});

test('guards see each flat\'s intercom but still no phone numbers', async () => {
  const r = await reg({ mobile: '9876500071', tower: 'D', flat: '402', intercom: '4020' });
  await sync(admin, { users: up({ id: r.body.session.id, status: 'approved' }) });
  await call('POST', '/api/admin/security', { name: 'Ramesh Yadav', mobile: '9876500099', password: 'guardpass' }, admin);
  const g = (await call('POST', '/api/auth/login', { id: '9876500099', password: 'guardpass' })).body.token;
  const u = (await call('GET', '/api/state', null, g)).body.db.users.find(x => x.id === r.body.session.id);
  assert.equal(u.intercom, '4020');
  assert.equal(u.mobile, '');
  assert.equal(u.proof, undefined);
});
