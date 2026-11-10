'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../lib/store');
const { bootstrap } = require('../lib/bootstrap');
const { load } = require('../lib/config');

let server, base, store;
const call = async (method, path, body, token, headers = {}) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers };
};
const sync = (token, changes) => call('POST', '/api/sync', { changes }, token);
const up = (...docs) => ({ upsert: docs });

const reg = (name, mobile, tower, flat, type = 'Owner') =>
  call('POST', '/api/auth/register', { name, mobile, tower, flat, type, password: 'secret123', members: 2 });

test.before(async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'x'.repeat(40), CLIENT_ORIGINS: 'https://app.example.com' });
  store = new MemoryStore();
  await bootstrap(store, config, { log() {} });
  server = createApp({ store, config });
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => server.close());

let admin, priya, ravi, priyaId, raviId;

test('health, defaults and public view', async () => {
  assert.equal((await call('GET', '/api/health')).body.ok, true);
  const p = await call('GET', '/api/public');
  assert.equal(p.body.db.settings.name, 'Queenstown Society');
  assert.equal(p.body.db.users.length, 0);
});

test('registration validates input and starts pending', async () => {
  assert.equal((await reg('Al', '9876500001', 'A', '101')).status, 400);
  assert.equal((await reg('Priya Nair', '12345', 'A', '101')).status, 400);
  const r = await reg('Priya Nair', '9876500001', 'A', '101');
  assert.equal(r.status, 201);
  priya = r.body.token; priyaId = r.body.session.id;
  assert.equal((await reg('Someone Else', '9876500001', 'B', '102')).status, 409, 'duplicate mobile');
  const s = await call('GET', '/api/state', null, priya);
  assert.equal(s.body.db.users.length, 1);
  assert.equal(s.body.db.users[0].status, 'pending');
  assert.equal(s.body.db.users[0].pass, undefined);
  assert.equal(s.body.db.notices.length, 0);
  const w = await sync(priya, { notices: up({ id: 'n1', title: 'hack' }) });
  assert.equal(w.status, 403, 'pending users cannot write');
});

test('admin login, wrong password and token checks', async () => {
  assert.equal((await call('POST', '/api/auth/login', { id: 'admin', password: 'nope' })).status, 401);
  assert.equal((await call('GET', '/api/state')).status, 401);
  assert.equal((await call('GET', '/api/state', null, 'a.b.c')).status, 401);
  const l = await call('POST', '/api/auth/login', { id: 'ADMIN', password: 'adminpass1' });
  assert.equal(l.status, 200);
  assert.deepEqual(l.body.session, { k: 'admin', username: 'admin' });
  admin = l.body.token;
  const s = await call('GET', '/api/state', null, admin);
  assert.equal(s.body.db.users.length, 1, 'admin sees the pending resident but not the admin account');
  assert.equal(s.body.db.users[0].pass, undefined);
  assert.ok(s.body.db.notifs.some(n => n.to === 'admin'), 'admin got a notification');
});

test('only the admin can approve; approval unlocks the app', async () => {
  const self = await sync(priya, { users: up({ id: priyaId, status: 'approved' }) });
  assert.equal(self.status, 403);
  const a = await sync(admin, { users: up({ id: priyaId, status: 'approved' }) });
  assert.equal(a.body.rejected.length, 0);
  const s = await call('GET', '/api/state', null, priya);
  assert.equal(s.body.db.users[0].status, 'approved');
  assert.ok(s.body.db.amenities.length >= 5);

  const r = await reg('Ravi Kumar', '9876500002', 'B', '202');
  ravi = r.body.token; raviId = r.body.session.id;
  await sync(admin, { users: up({ id: raviId, status: 'approved' }) });
});

test('residents cannot write admin content, but can use their own features', async () => {
  await sync(admin, {
    notices: up({ id: 'n1', title: 'Water cut', body: 'Tomorrow', category: 'General', priority: 'normal', pinned: false, date: new Date().toISOString(), author: 'Office', readBy: [] }),
    events: up({ id: 'e1', title: 'Yoga', date: new Date(Date.now() + 3 * 864e5).toISOString(), venue: 'Lawn', category: 'Wellness', scene: 'yoga', rsvps: {}, featured: true }),
    polls: up({ id: 'p1', question: 'Solar?', options: [{ t: 'Yes' }, { t: 'No' }], votes: {}, closes: new Date(Date.now() + 864e5).toISOString(), status: 'open' }),
    bills: up(
      { id: 'b1', flat: 'A-101', month: '2026-11', amount: 3300, items: [], dueDate: new Date(Date.now() + 5 * 864e5).toISOString(), status: 'due' },
      { id: 'b2', flat: 'B-202', month: '2026-11', amount: 3300, items: [], dueDate: new Date(Date.now() + 5 * 864e5).toISOString(), status: 'due' })
  });

  // cannot edit or delete a notice, cannot create events
  assert.equal((await sync(priya, { notices: up({ id: 'n1', title: 'Hacked' }) })).body.rejected.length, 0, 'ignored without a change');
  let s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(s.notices[0].title, 'Water cut');
  assert.equal((await sync(priya, { notices: { remove: ['n1'] } })).body.rejected.length, 1);
  assert.equal((await sync(priya, { events: up({ id: 'e9', title: 'Rave' }) })).body.rejected.length, 1);

  // read receipt, RSVP and vote
  await sync(priya, { notices: up({ id: 'n1', readBy: [priyaId] }), events: up({ id: 'e1', title: 'Renamed', rsvps: { [priyaId]: 'yes' } }), polls: up({ id: 'p1', votes: { 'A-101': 1 } }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.deepEqual(s.notices[0].readBy, [priyaId]);
  assert.equal(s.events[0].title, 'Yoga', 'title change is ignored');
  assert.equal(s.events[0].rsvps[priyaId], 'yes');
  assert.equal(s.polls[0].votes['A-101'], 1);
  await sync(priya, { polls: up({ id: 'p1', votes: { 'A-101': 0 } }) });
  assert.equal((await call('GET', '/api/state', null, priya)).body.db.polls[0].votes['A-101'], 1, 'one vote per flat');
  await sync(ravi, { polls: up({ id: 'p1', votes: { 'B-202': 0 } }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(Object.keys(s.polls[0].votes).length, 2);
  assert.ok(!Object.keys(s.polls[0].votes).includes('B-202'), 'other flats votes are anonymous');
  // admin edit keeps RSVPs and votes
  await sync(admin, { events: up({ id: 'e1', title: 'Yoga Morning', date: new Date(Date.now() + 3 * 864e5).toISOString(), venue: 'Lawn', rsvps: {} }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(s.events[0].title, 'Yoga Morning');
  assert.equal(s.events[0].rsvps[priyaId], 'yes');
});

test('bills: residents see only their flat in detail and can only submit a payment', async () => {
  let s = (await call('GET', '/api/state', null, priya)).body.db;
  const mine = s.bills.find(b => b.id === 'b1'), other = s.bills.find(b => b.id === 'b2');
  assert.equal(mine.flat, 'A-101');
  assert.equal(other.flat, '', 'other flats are redacted');
  assert.equal(other.redacted, true);

  let r = await sync(priya, { bills: up({ id: 'b2', status: 'verifying', method: 'UPI', ref: 'X' }) });
  assert.equal(r.body.rejected.length, 1, 'cannot touch another flat');
  await sync(priya, { bills: up({ id: 'b1', status: 'paid', amount: 1, method: 'UPI', ref: 'FAKE' }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(s.bills.find(b => b.id === 'b1').status, 'due', 'cannot mark own bill paid');
  await sync(priya, { bills: up({ id: 'b1', status: 'verifying', amount: 1, method: 'UPI', ref: 'UTR123456789' }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  const b1 = s.bills.find(b => b.id === 'b1');
  assert.equal(b1.status, 'verifying');
  assert.equal(b1.amount, 3300, 'amount cannot be changed');
  assert.equal(b1.ref, 'UTR123456789');
  await sync(admin, { bills: up({ ...b1, status: 'paid', paidOn: new Date().toISOString() }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(s.bills.find(b => b.id === 'b1').status, 'paid');
});

test('tickets, bookings, visitors and ads stay private and are normalised', async () => {
  await sync(priya, { complaints: up({ id: 'c1', userId: 'someoneelse', category: 'Lift', title: 'Noisy lift', body: 'Grinding', priority: 'high', status: 'resolved', comments: [{ by: 'Society Office', text: 'fake', at: 1, admin: true }] }) });
  let s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(s.complaints.length, 1);
  assert.equal(s.complaints[0].userId, priyaId);
  assert.equal(s.complaints[0].status, 'open');
  assert.equal(s.complaints[0].comments.length, 0);
  assert.equal((await call('GET', '/api/state', null, ravi)).body.db.complaints.length, 0, 'others cannot see it');
  await sync(priya, { complaints: up({ id: 'c1', comments: [{ text: 'Still noisy', at: 5, by: 'x', admin: true }] }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(s.complaints[0].comments[0].by, 'Priya Nair');
  assert.equal(s.complaints[0].comments[0].admin, false);
  await sync(admin, { complaints: up({ id: 'c1', status: 'in-progress', assignee: 'Lift Care', comments: [{ text: 'Engineer on the way', at: 9 }] }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(s.complaints[0].status, 'in-progress');
  assert.equal(s.complaints[0].comments.length, 2);

  const day = new Date(Date.now() + 2 * 864e5); day.setHours(0, 0, 0, 0);
  await sync(priya, { bookings: up({ id: 'k1', amenityId: 'am3', userId: 'x', date: day.toISOString(), slot: 'Evening', purpose: 'Tennis', status: 'approved' }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(s.bookings[0].status, 'pending');
  const clash = await sync(ravi, { bookings: up({ id: 'k2', amenityId: 'am3', date: day.toISOString(), slot: 'Evening', purpose: 'Me too' }) });
  assert.equal(clash.body.rejected.length, 1, 'double booking is refused');
  s = (await call('GET', '/api/state', null, ravi)).body.db;
  assert.equal(s.bookings[0].purpose, '', 'purpose of others is hidden');
  assert.equal(s.bookings[0].userId, '');

  await sync(priya, { visitors: up({ id: 'v1', name: 'Courier', purpose: 'Delivery', date: new Date().toISOString(), code: '482913' }) });
  assert.equal((await call('GET', '/api/state', null, ravi)).body.db.visitors.length, 0);
  assert.equal((await call('GET', '/api/state', null, admin)).body.db.visitors.length, 1);

  await sync(priya, { ads: up({ id: 'a1', type: 'banner', weeks: 2, fee: 0, feePaid: true, status: 'live', title: 'Tuition', body: 'Maths', contact: '98765', category: 'Tuition' }) });
  s = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(s.ads[0].status, 'pending');
  assert.equal(s.ads[0].fee, 1000, 'fee is 2 weeks x 500');
  assert.equal(s.ads[0].feePaid, false);
  assert.equal((await call('GET', '/api/state', null, ravi)).body.db.ads.length, 0, 'pending ads are not public');
});

test('directory hides private fields; profile edits are limited', async () => {
  await sync(priya, { users: up({ id: priyaId, name: 'Priya N.', vehicle: 'WB 01 A 1234', showPhone: true, status: 'rejected', role: 'admin', mobile: '9000000000' }) });
  const s = (await call('GET', '/api/state', null, ravi)).body.db;
  const p = s.users.find(u => u.id === priyaId);
  assert.equal(p.name, 'Priya N.');
  assert.equal(p.status, 'approved');
  assert.equal(p.role, 'resident');
  assert.equal(p.mobile, '9876500001', 'shown because she allowed it');
  assert.equal(p.vehicle, '', 'vehicle is private');
  const me = s.users.find(u => u.id === raviId);
  assert.equal(me.mobile, '9876500002');
  assert.equal((await sync(ravi, { users: up({ id: priyaId, name: 'x' }) })).body.rejected.length, 1);
});

test('log is admin only; public view shows only the forecast', async () => {
  assert.equal((await call('GET', '/api/state', null, priya)).body.db.log.length, 0);
  assert.ok((await call('GET', '/api/state', null, admin)).body.db.log.length >= 1);
  const p = (await call('GET', '/api/public')).body.db;
  assert.equal(p.events[0].title, 'Yoga Morning');
  assert.equal(p.events[0].desc, '');
  assert.equal(p.notices.length, 0);
  assert.equal(p.bills.length, 0);
});

test('passwords: change, reset by admin, old tokens stop working', async () => {
  assert.equal((await call('POST', '/api/auth/password', { current: 'wrong', next: 'newpass123' }, ravi)).status, 400);
  assert.equal((await call('POST', '/api/auth/password', { current: 'secret123', next: 'abc' }, ravi)).status, 400);
  const c = await call('POST', '/api/auth/password', { current: 'secret123', next: 'newpass123' }, ravi);
  assert.equal(c.status, 200);
  assert.equal((await call('GET', '/api/state', null, ravi)).status, 401, 'old token is revoked');
  assert.equal((await call('POST', '/api/auth/login', { id: '9876500002', password: 'newpass123' })).status, 200);
  assert.equal((await call('POST', `/api/admin/users/${raviId}/password`, {}, priya)).status, 403);
  const r = await call('POST', `/api/admin/users/${raviId}/password`, {}, admin);
  assert.equal(r.status, 200);
  assert.equal((await call('POST', '/api/auth/login', { id: '9876500002', password: r.body.password })).status, 200);
  const a = await call('POST', '/api/auth/password', { current: 'adminpass1', next: 'adminpass2', username: 'secretary' }, admin);
  assert.equal(a.status, 200);
  assert.equal((await call('POST', '/api/auth/login', { id: 'secretary', password: 'adminpass2' })).status, 200);
});

test('rejected residents can withdraw and register again; approved cannot', async () => {
  const r = await reg('Neha Bansal', '9876500003', 'C', '303');
  const id = r.body.session.id;
  const adm = (await call('POST', '/api/auth/login', { id: 'secretary', password: 'adminpass2' })).body.token;
  await sync(adm, { users: up({ id, status: 'rejected', reason: 'Documents missing' }) });
  const s = await call('GET', '/api/state', null, r.body.token);
  assert.equal(s.body.db.users[0].reason, 'Documents missing');
  assert.equal((await call('POST', '/api/auth/withdraw', {}, r.body.token)).status, 200);
  assert.equal((await reg('Neha Bansal', '9876500003', 'C', '303')).status, 201);
  assert.equal((await call('POST', '/api/auth/withdraw', {}, priya)).status, 400);
});

test('CORS allows the configured site only; bad bodies are refused', async () => {
  const ok = await call('OPTIONS', '/api/state', null, null, { Origin: 'https://app.example.com' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.example.com');
  const bad = await call('OPTIONS', '/api/state', null, null, { Origin: 'https://evil.example.com' });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const j = await fetch(base + '/api/auth/login', { method: 'POST', body: '{not json' });
  assert.equal(j.status, 400);
  const adm = (await call('POST', '/api/auth/login', { id: 'secretary', password: 'adminpass2' })).body.token;
  const raw = await fetch(base + '/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adm },
    body: '{"changes":{"notices":{"upsert":[{"id":"n8","title":"t","__proto__":{"x":1}}]}}}' });
  const rb = await raw.json();
  assert.equal(rb.rejected.length, 1, '__proto__ field is refused');
  const keys = await sync(adm, { notices: up({ id: 'n7', title: 't', 'a.b': 1 }) });
  assert.equal(keys.body.rejected.length, 1, 'dotted field names are refused');
});
