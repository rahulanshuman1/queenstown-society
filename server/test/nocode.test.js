'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const flows = require('../lib/flows');
const { createApp } = require('../server');
const { MemoryStore } = require('../lib/store');
const { bootstrap } = require('../lib/bootstrap');
const { load } = require('../lib/config');

/* ---------- the engine on its own (pure functions) ---------- */
const BP = {
  forms: [{ id: 'move', name: 'Move-in request', fields: [
    { id: 'when', label: 'Date', type: 'date', req: true },
    { id: 'size', label: 'Vehicle', type: 'select', options: ['Bike', 'Truck'], req: true },
    { id: 'n', label: 'Items', type: 'number' },
    { id: 'ok', label: 'I agree', type: 'checkbox', req: true }] }],
  flows: [
    { id: 'w1', name: 'Bike moves are auto approved', trigger: 'request.created', formId: 'move',
      conds: [{ field: 'a.size', op: 'is', value: 'bike' }],
      actions: [{ type: 'set_status', value: 'approved' }, { type: 'notify_resident', text: 'Hi {{name}}, {{form}} for {{a.when}} is approved' }] },
    { id: 'w2', name: 'Truck moves ping the office', trigger: 'request.created', conds: [{ field: 'a.size', op: 'is', value: 'Truck' }, { field: 'a.n', op: 'gt', value: '10' }],
      actions: [{ type: 'notify_admin', text: '{{flat}} needs a truck slot' }] },
    { id: 'w3', name: 'Lift tickets', trigger: 'complaint.created', conds: [{ field: 'category', op: 'contains', value: 'lift' }],
      actions: [{ type: 'assign', value: 'Lift vendor' }, { type: 'set_status', value: 'in-progress' }, { type: 'post_notice', title: 'Lift issue: {{title}}', text: 'We are on it.' }] },
    { id: 'w4', name: 'off', on: false, trigger: 'request.created', actions: [{ type: 'notify_admin', text: 'never' }] }
  ]
};

test('clean drops unknown things and keeps the shape', () => {
  const c = flows.clean({ modules: { polls: false, hack: false, events: true }, forms: [{ fields: [{ type: 'bogus', label: '' }, { type: 'select', options: [] }] }], flows: [{ trigger: 'nope', actions: [{ type: 'rm -rf' }, { type: 'notify_admin', text: 'x' }] }], evil: 1 });
  assert.deepEqual(c.modules, { polls: false });
  assert.equal(c.forms[0].fields[0].type, 'text');
  assert.deepEqual(c.forms[0].fields[1].options, ['Option 1', 'Option 2']);
  assert.equal(c.flows[0].trigger, 'request.created');
  assert.equal(c.flows[0].actions.length, 1);
  assert.equal(c.evil, undefined);
  assert.deepEqual(flows.clean(null), { template: '', modules: {}, forms: [], flows: [] });
});

test('answers are checked against the form', () => {
  const f = flows.clean(BP).forms[0];
  assert.ok(flows.checkAnswers(f, { when: '2026-12-01', size: 'Bike', ok: true }).answers);
  assert.match(flows.checkAnswers(f, { size: 'Bike', ok: true }).err, /Date/);
  assert.match(flows.checkAnswers(f, { when: '2026-12-01', size: 'Plane', ok: true }).err, /options/);
  assert.match(flows.checkAnswers(f, { when: 'tomorrow', size: 'Bike', ok: true }).err, /date/);
  assert.match(flows.checkAnswers(f, { when: '2026-12-01', size: 'Bike', ok: false }).err, /tick/);
  assert.match(flows.checkAnswers(f, { when: '2026-12-01', size: 'Bike', n: 'many', ok: true }).err, /number/);
  assert.equal(flows.checkAnswers(f, { when: '2026-12-01', size: 'Bike', ok: true, extra: 'x' }).answers.extra, undefined);
});

test('automations fire only when the trigger, form and conditions match', () => {
  const rec = { formId: 'move', name: 'Priya', flat: 'A-101', form: 'Move-in request', answers: { when: '2026-12-01', size: 'Bike' } };
  const e = flows.run(BP, 'request.created', rec);
  assert.deepEqual(e.map(x => x.type), ['set_status', 'notify_resident']);
  assert.equal(e[1].text, 'Hi Priya, Move-in request for 2026-12-01 is approved', 'case-insensitive match, tokens filled');
  assert.equal(flows.run(BP, 'request.created', { ...rec, formId: 'other' }).length, 0, 'wrong form');
  const t = flows.run(BP, 'request.created', { ...rec, answers: { size: 'Truck', n: '12' } });
  assert.equal(t[0].text, 'A-101 needs a truck slot');
  assert.equal(flows.run(BP, 'request.created', { ...rec, answers: { size: 'Truck', n: '3' } }).length, 0, 'number condition');
  assert.ok(!flows.run(BP, 'request.created', rec).some(x => x.text === 'never'), 'switched off automations never run');
  const c = flows.run(BP, 'complaint.created', { category: 'Lift', title: 'Stuck' });
  assert.deepEqual(c.map(x => x.type), ['assign', 'set_status', 'post_notice']);
  assert.equal(c[2].title, 'Lift issue: Stuck');
  assert.equal(flows.run(BP, 'request.created', { ...rec, answers: { size: 'Bike' } }).filter(x => x.type === 'set_status' && x.value === 'in-progress').length, 0);
});

/* ---------- through the real API ---------- */
let server, base;
const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sync = (t, changes) => call('POST', '/api/sync', { changes }, t);
let admin, priya, ravi, priyaId;

test.before(async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'x'.repeat(40), CLIENT_ORIGINS: 'https://app.example.com' });
  const store = new MemoryStore();
  await bootstrap(store, config, { log() {} });
  server = createApp({ store, config });
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
  admin = (await call('POST', '/api/auth/login', { id: 'admin', password: 'adminpass1' })).body.token;
  const mk = async (name, mobile, flat, type) => {
    const r = await call('POST', '/api/auth/register', { name, mobile, tower: 'A', flat, type, password: 'secret123', members: 2 });
    await sync(admin, { users: { upsert: [{ id: r.body.session.id, status: 'approved' }] } });
    return r.body;
  };
  const p = await mk('Priya Nair', '9876500001', '101', 'Owner'); priya = p.token; priyaId = p.session.id;
  ravi = (await mk('Ravi Rao', '9876500002', '102', 'Tenant')).token;
});
test.after(() => server.close());

test('only the admin can save a blueprint, and it is cleaned on the way in', async () => {
  const s = (await call('GET', '/api/state', null, admin)).body.db.settings;
  const mine = await sync(priya, { settings: { upsert: [{ ...s, nocode: BP }] } });
  assert.equal((await call('GET', '/api/state', null, priya)).body.db.settings.nocode, undefined, 'resident cannot write settings');
  assert.equal(mine.status, 200);
  const bad = { ...BP, modules: { polls: false, junk: false }, forms: [...BP.forms, { id: 'tenants', name: 'Tenants only', audience: 'Tenant', fields: [{ id: 'x', label: 'Note', type: 'text' }] }] };
  const r = await sync(admin, { settings: { upsert: [{ ...s, nocode: bad }] } });
  assert.equal(r.body.rejected.length, 0);
  const got = (await call('GET', '/api/state', null, priya)).body.db.settings.nocode;
  assert.deepEqual(got.modules, { polls: false });
  assert.equal(got.forms.length, 2);
});

test('a resident submits a form: answers are checked, status is pending, and the automation runs on the server', async () => {
  const bad = await sync(priya, { requests: { upsert: [{ id: 'r1', formId: 'move', answers: { size: 'Bike', ok: true } }] } });
  assert.match(bad.body.rejected[0].err, /Date/);
  const nope = await sync(priya, { requests: { upsert: [{ id: 'r2', formId: 'ghost', answers: {} }] } });
  assert.match(nope.body.rejected[0].err, /not available/);
  const sneaky = await sync(priya, { requests: { upsert: [{ id: 'r3', formId: 'move', userId: 'someone', status: 'done', answers: { when: '2026-12-01', size: 'Truck', n: 20, ok: true } }] } });
  assert.equal(sneaky.body.rejected.length, 0);
  let st = (await call('GET', '/api/state', null, priya)).body.db;
  const r3 = st.requests.find(r => r.id === 'r3');
  assert.equal(r3.userId, priyaId, 'resident files as themselves');
  assert.equal(r3.status, 'pending', 'status cannot be chosen by the resident');
  const adm = (await call('GET', '/api/state', null, admin)).body.db;
  assert.ok(adm.notifs.some(n => n.text === 'A-101 needs a truck slot' && n.to === 'admin'), 'automation notified the admin');

  await sync(priya, { requests: { upsert: [{ id: 'r4', formId: 'move', answers: { when: '2026-12-02', size: 'Bike', ok: true } }] } });
  st = (await call('GET', '/api/state', null, priya)).body.db;
  assert.equal(st.requests.find(r => r.id === 'r4').status, 'approved', 'auto approved by the automation');
  assert.ok(st.notifs.some(n => /Priya Nair, Move-in request for 2026-12-02 is approved/.test(n.text)), 'resident was told');
});

test('requests are private; only the admin decides; audience is enforced', async () => {
  const rv = (await call('GET', '/api/state', null, ravi)).body.db;
  assert.equal(rv.requests.length, 0, "Ravi cannot see Priya's requests");
  const own = await sync(priya, { requests: { upsert: [{ id: 'r3', status: 'approved', note: 'me too' }] } });
  assert.equal((await call('GET', '/api/state', null, priya)).body.db.requests.find(r => r.id === 'r3').status, 'pending');
  assert.equal(own.status, 200);
  const aud = await sync(priya, { requests: { upsert: [{ id: 'r5', formId: 'tenants', answers: { x: 'hi' } }] } });
  assert.match(aud.body.rejected[0].err, /tenants/i, 'owners cannot use a tenants only form');
  assert.equal((await sync(ravi, { requests: { upsert: [{ id: 'r6', formId: 'tenants', answers: { x: 'hi' } }] } })).body.rejected.length, 0);
  const d = await sync(admin, { requests: { upsert: [{ id: 'r3', status: 'rejected', note: 'No truck slots', answers: { size: 'tampered' } }] } });
  assert.equal(d.body.rejected.length, 0);
  const r3 = (await call('GET', '/api/state', null, priya)).body.db.requests.find(r => r.id === 'r3');
  assert.equal(r3.status, 'rejected');
  assert.equal(r3.note, 'No truck slots');
  assert.equal(r3.answers.size, 'Truck', 'answers cannot be edited afterwards');
  const rm = await sync(priya, { requests: { remove: ['r3'] } });
  assert.ok((await call('GET', '/api/state', null, priya)).body.db.requests.some(r => r.id === 'r3'), 'resident cannot delete');
  assert.equal(rm.status, 200);
});

test('helpdesk tickets trigger automations too', async () => {
  await sync(priya, { complaints: { upsert: [{ id: 'c1', category: 'Lift', title: 'Stuck lift', body: 'B block', priority: 'high' }] } });
  const st = (await call('GET', '/api/state', null, priya)).body.db;
  const c = st.complaints.find(x => x.id === 'c1');
  assert.equal(c.assignee, 'Lift vendor');
  assert.equal(c.status, 'in-progress');
  assert.ok(st.notices.some(n => n.title === 'Lift issue: Stuck lift' && n.author.includes('automation')));
});
