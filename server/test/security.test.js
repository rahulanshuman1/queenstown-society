'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../lib/store');
const { bootstrap } = require('../lib/bootstrap');
const { load } = require('../lib/config');

let server, base;
const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sync = (t, changes) => call('POST', '/api/sync', { changes }, t);
const up = (...d) => ({ upsert: d });
const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(2000);

test.before(async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'x'.repeat(40), CLIENT_ORIGINS: 'https://app.example.com' });
  const store = new MemoryStore(); await bootstrap(store, config, { log() {} });
  server = createApp({ store, config }); await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => server.close());

test('guard accounts, walk-in photo visitor, resident approval, entry and exit', async () => {
  const admin = (await call('POST', '/api/auth/login', { id: 'admin', password: 'adminpass1' })).body.token;
  const r = await call('POST', '/api/auth/register', { name: 'Priya Nair', mobile: '9876500001', tower: 'A', flat: '101', type: 'Owner', password: 'secret123', members: 2 });
  const priya = r.body.token, priyaId = r.body.session.id;
  const r2 = await call('POST', '/api/auth/register', { name: 'Ravi Kumar', mobile: '9876500002', tower: 'B', flat: '202', type: 'Owner', password: 'secret123', members: 2 });
  const ravi = r2.body.token, raviId = r2.body.session.id;
  await sync(admin, { users: up({ id: priyaId, status: 'approved' }, { id: raviId, status: 'approved' }) });

  // only the admin can add a guard
  assert.equal((await call('POST', '/api/admin/security', { name: 'Ramesh Yadav', mobile: '9876500099', password: 'guardpass' }, priya)).status, 403);
  assert.equal((await call('POST', '/api/admin/security', { name: 'Ramesh Yadav', mobile: '123', password: 'guardpass' }, admin)).status, 400);
  const mk = await call('POST', '/api/admin/security', { name: 'Ramesh Yadav', mobile: '9876500099', password: 'guardpass' }, admin);
  assert.equal(mk.status, 201);
  assert.equal((await call('POST', '/api/admin/security', { name: 'Other Guard', mobile: '9876500099', password: 'guardpass' }, admin)).status, 409, 'mobile already used');

  const g = await call('POST', '/api/auth/login', { id: '9876500099', password: 'guardpass' });
  assert.equal(g.status, 200);
  const guard = g.body.token, guardId = g.body.session.id;

  // what a guard can see
  const st = await call('GET', '/api/state', null, guard);
  assert.equal(st.status, 200);
  assert.deepEqual(st.body.db.bills, []); assert.deepEqual(st.body.db.complaints, []); assert.deepEqual(st.body.db.ads, []);
  assert.ok(st.body.db.users.some(u => u.id === priyaId), 'guard sees the flat directory');
  assert.equal(st.body.db.users.find(u => u.id === priyaId).mobile, '', 'resident phone numbers stay private');
  // residents do not see the guard in their directory
  const rs = await call('GET', '/api/state', null, priya);
  assert.ok(!rs.body.db.users.some(u => u.id === guardId));
  // a guard cannot write notices or bills
  assert.equal((await sync(guard, { notices: up({ id: 'n1', title: 'x', body: 'y' }) })).body.rejected.length, 1);

  // walk-in: photo, flat, name
  const bad = await sync(guard, { visitors: up({ id: 'vbad', userId: guardId, name: 'Nobody', purpose: 'Delivery' }) });
  assert.equal(bad.body.rejected.length, 1, 'must pick a real resident flat');
  const ok = await sync(guard, { visitors: up({ id: 'v1', userId: priyaId, name: 'Amit (courier)', phone: '98 765-43210', purpose: 'Delivery', vehicle: 'MH12AB1234', photo: PHOTO, status: 'entered' }) });
  assert.equal(ok.body.rejected.length, 0);
  let v = ok.body.db.visitors.find(x => x.id === 'v1');
  assert.equal(v.status, 'waiting', 'a guard cannot skip the resident');
  assert.equal(v.phone, '9876543210'); assert.equal(v.photo, PHOTO); assert.equal(v.byName, 'Ramesh Yadav');
  assert.equal((await sync(guard, { visitors: up({ id: 'v1', status: 'entered' }) })).body.db.visitors[0].status, 'waiting', 'cannot enter before approval');

  // an oversized or fake photo is dropped
  const fake = await sync(guard, { visitors: up({ id: 'v2', userId: raviId, name: 'Sneaky', purpose: 'Guest', photo: 'javascript:alert(1)' }) });
  assert.equal(fake.body.db.visitors.find(x => x.id === 'v2').photo, '');

  // the resident is notified and only sees their own visitor
  const mine = await call('GET', '/api/state', null, priya);
  assert.ok(mine.body.db.notifs.some(n => n.text.includes('Amit') && n.link === 'visitors'));
  assert.deepEqual(mine.body.db.visitors.map(x => x.id), ['v1']);
  // another resident cannot decide for them
  assert.equal((await sync(ravi, { visitors: up({ id: 'v1', status: 'approved' }) })).body.rejected.length, 1);
  // guard cannot approve; resident can
  await sync(guard, { visitors: up({ id: 'v1', status: 'approved' }) });
  assert.equal((await call('GET', '/api/state', null, guard)).body.db.visitors.find(x => x.id === 'v1').status, 'waiting');
  const ap = await sync(priya, { visitors: up({ id: 'v1', status: 'approved' }) });
  assert.equal(ap.body.db.visitors.find(x => x.id === 'v1').status, 'approved');
  // guard is told
  assert.ok((await call('GET', '/api/state', null, guard)).body.db.notifs.some(n => n.text.includes('A-101') && n.text.includes('approved')));
  // entry and exit
  let e = await sync(guard, { visitors: up({ id: 'v1', status: 'entered' }) });
  assert.equal(e.body.db.visitors.find(x => x.id === 'v1').status, 'entered');
  assert.ok((await call('GET', '/api/state', null, priya)).body.db.notifs.some(n => n.text.includes('has entered')));
  e = await sync(guard, { visitors: up({ id: 'v1', status: 'exited' }) });
  const done = e.body.db.visitors.find(x => x.id === 'v1');
  assert.equal(done.status, 'exited'); assert.ok(done.entryAt && done.exitAt);

  // denial
  await sync(ravi, {});
  const w = await sync(guard, { visitors: up({ id: 'v3', userId: raviId, name: 'Stranger', purpose: 'Sales' }) });
  assert.equal(w.body.rejected.length, 0);
  const dn = await sync(ravi, { visitors: up({ id: 'v3', status: 'denied' }) });
  assert.equal(dn.body.db.visitors.find(x => x.id === 'v3').status, 'denied');
  assert.equal((await sync(guard, { visitors: up({ id: 'v3', status: 'entered' }) })).body.db.visitors.find(x => x.id === 'v3').status, 'denied', 'denied visitors cannot enter');

  // pre-approved code visitor: the guard lets them in
  const code = await sync(priya, { visitors: up({ id: 'v4', name: 'Aunt Sunita', purpose: 'Family', date: new Date().toISOString(), code: '123456' }) });
  assert.equal(code.body.rejected.length, 0);
  assert.equal((await sync(guard, { visitors: up({ id: 'v4', status: 'entered' }) })).body.db.visitors.find(x => x.id === 'v4').status, 'entered');

  // the office sees guards in the members list, keeps their role and can disable them
  const adm = await call('GET', '/api/state', null, admin);
  assert.equal(adm.body.db.users.find(u => u.id === guardId).role, 'security');
  const keep = await sync(admin, { users: up({ ...adm.body.db.users.find(u => u.id === guardId), name: 'Ramesh Y.' }) });
  assert.equal(keep.body.rejected.length, 0);
  assert.equal((await sync(admin, { users: up({ id: guardId, status: 'approved' }) })).body.rejected.length, 1, 'a guard cannot become a resident');
  await sync(admin, { users: up({ id: guardId, status: 'rejected' }) });
  assert.equal((await sync(guard, { visitors: up({ id: 'v9', userId: priyaId, name: 'Late', purpose: 'x' }) })).status, 403, 'disabled guard is locked out');
});
