'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { penaltyOf, penaltyCfg, cleanPenalty } = require('../lib/penalty');
const { priceBills } = require('../lib/payments');
const { MemoryStore } = require('../lib/store');
const { createApp } = require('../server');
const { bootstrap } = require('../lib/bootstrap');
const { load } = require('../lib/config');

const DAY = 86400e3;
const due = Date.UTC(2026, 10, 15, 18, 29); // end of the due day
const P = o => ({ penalty: { enabled: true, graceDays: 0, type: 'percent', value: 2, repeat: 'once', cap: 0, ...o } });

test('no penalty until the due date and grace period have passed', () => {
  assert.equal(penaltyOf(3300, due, P(), due - DAY), 0);
  assert.equal(penaltyOf(3300, due, P(), due), 0, 'still on time at the last minute');
  assert.equal(penaltyOf(3300, due, P(), due + 1000), 66);
  assert.equal(penaltyOf(3300, due, P({ graceDays: 5 }), due + 5 * DAY), 0, 'inside grace');
  assert.equal(penaltyOf(3300, due, P({ graceDays: 5 }), due + 5 * DAY + 1000), 66);
});

test('percent or fixed, once, monthly or daily, with a cap', () => {
  assert.equal(penaltyOf(3300, due, P({ repeat: 'once' }), due + 100 * DAY), 66);
  assert.equal(penaltyOf(3300, due, P({ repeat: 'monthly' }), due + 29 * DAY), 66);
  assert.equal(penaltyOf(3300, due, P({ repeat: 'monthly' }), due + 31 * DAY), 132);
  assert.equal(penaltyOf(3300, due, P({ type: 'fixed', value: 50, repeat: 'daily' }), due + 0.5 * DAY), 50);
  assert.equal(penaltyOf(3300, due, P({ type: 'fixed', value: 50, repeat: 'daily' }), due + 3.5 * DAY), 200);
  assert.equal(penaltyOf(3300, due, P({ type: 'fixed', value: 50, repeat: 'daily', cap: 500 }), due + 60 * DAY), 500);
});

test('switched off means no penalty; old latePct setting still works when no rules are saved', () => {
  assert.equal(penaltyOf(3300, due, P({ enabled: false }), due + 9 * DAY), 0);
  assert.equal(penaltyOf(3300, due, { latePct: 2 }, due + DAY), 66);
  assert.equal(penaltyOf(3300, due, { latePct: 0 }, due + DAY), 0);
  assert.deepEqual(penaltyCfg({ latePct: 2 }), { enabled: true, graceDays: 0, type: 'percent', value: 2, repeat: 'once', cap: 0 });
});

test('junk input is cleaned', () => {
  assert.deepEqual(cleanPenalty({ enabled: 1, graceDays: 999, type: 'x', value: 500, repeat: 'hourly', cap: -4 }),
    { enabled: true, graceDays: 60, type: 'percent', value: 100, repeat: 'once', cap: 0 });
  assert.equal(cleanPenalty(null).enabled, false);
});

test('bills are priced by the server with the saved penalty rules', async () => {
  const store = new MemoryStore();
  await store.put('bills', { id: 'b1', flat: 'A-101', month: '2026-11', amount: 3000, dueDate: new Date(due).toISOString(), status: 'due' });
  const user = { id: 'u1', tower: 'A', flat: '101' };
  const run = (settings, now) => priceBills({ store, user, billIds: ['b1'], settings, now });
  assert.equal((await run(P({ type: 'fixed', value: 100, graceDays: 3 }), due + 2 * DAY)).total, 3000);
  assert.equal((await run(P({ type: 'fixed', value: 100, graceDays: 3 }), due + 4 * DAY)).total, 3100);
});

test('admin saves penalty rules in Society setup; they are cleaned and shown to residents', async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'z'.repeat(40), CLIENT_ORIGINS: 'https://app.example.com' });
  const store = new MemoryStore();
  await bootstrap(store, config, { log() {} });
  const server = createApp({ store, config });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (m, p, b, t) => { const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  try {
    const admin = (await call('POST', '/api/auth/login', { id: 'admin', password: 'adminpass1' })).body.token;
    const r = await call('POST', '/api/sync', { changes: { settings: { upsert: [{ id: 'settings', penalty: { enabled: true, graceDays: '5', type: 'fixed', value: '75.456', repeat: 'daily', cap: '900', evil: 1 } }] } } }, admin);
    assert.equal(r.status, 200);
    const s = (await call('GET', '/api/state', null, admin)).body.db.settings;
    assert.deepEqual(s.penalty, { enabled: true, graceDays: 5, type: 'fixed', value: 75.46, repeat: 'daily', cap: 900 });
  } finally { server.close(); }
});
