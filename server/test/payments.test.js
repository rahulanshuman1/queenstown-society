'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createApp } = require('../server');
const { MemoryStore } = require('../lib/store');
const { bootstrap } = require('../lib/bootstrap');
const { load } = require('../lib/config');
const razorpay = require('../lib/razorpay');

const KEY_ID = 'rzp_test_abc123', KEY_SECRET = 'secret_for_tests', HOOK = 'hook_secret_for_tests';
const hmac = (s, d) => crypto.createHmac('sha256', s).update(d).digest('hex');

let server, base, store, admin, priya, priyaId, ravi, razorpayCalls = [], nextOrder = 1;

/* A stand-in for api.razorpay.com. The real client code (auth header, request body, signatures) still runs. */
const fakeFetch = async (url, opt) => {
  const body = JSON.parse(opt.body);
  razorpayCalls.push({ url, auth: opt.headers.Authorization, body });
  return { ok: true, status: 200, json: async () => ({ id: 'order_T' + String(nextOrder++).padStart(6, '0'), amount: body.amount, currency: 'INR' }) };
};

const call = async (method, path, body, token, headers = {}, raw) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sync = (token, changes) => call('POST', '/api/sync', { changes }, token);
const reg = (name, mobile, tower, flat) => call('POST', '/api/auth/register', { name, mobile, tower, flat, type: 'Owner', password: 'secret123', members: 2 });
const sign = (orderId, paymentId) => hmac(KEY_SECRET, orderId + '|' + paymentId);
const order = (token, billIds) => call('POST', '/api/payments/order', { billIds }, token);
const hook = (event, secret = HOOK) => { const raw = JSON.stringify(event); return call('POST', '/api/payments/webhook', null, null, { 'X-Razorpay-Signature': hmac(secret, raw) }, raw); };
const bill = async (id, token) => (await call('GET', '/api/state', null, token)).body.db.bills.find(b => b.id === id);

const dueIn = days => new Date(Date.now() + days * 864e5).toISOString();

test.before(async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'x'.repeat(40), CLIENT_ORIGINS: 'https://app.example.com' });
  store = new MemoryStore();
  await bootstrap(store, config, { log() {} });
  const rzp = razorpay.create({ keyId: KEY_ID, keySecret: KEY_SECRET, webhookSecret: HOOK }, fakeFetch);
  server = createApp({ store, config, razorpay: rzp });
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;

  admin = (await call('POST', '/api/auth/login', { id: 'admin', password: 'adminpass1' })).body.token;
  const p = await reg('Priya Nair', '9876500001', 'A', '101'); priya = p.body.token; priyaId = p.body.session.id;
  const r = await reg('Ravi Das', '9876500002', 'B', '202'); ravi = r.body.token;
  const rid = r.body.session.id;
  await sync(admin, { users: { upsert: [{ id: priyaId, status: 'approved' }, { id: rid, status: 'approved' }] } });
  const items = [{ label: 'Maintenance', amt: 3000 }];
  await sync(admin, { bills: { upsert: [
    { id: 'bnov', flat: 'A-101', month: '2026-11', amount: 3300, items, dueDate: dueIn(5), status: 'due' },
    { id: 'boct', flat: 'A-101', month: '2026-10', amount: 3300, items, dueDate: dueIn(-10), status: 'due' },
    { id: 'bsep', flat: 'A-101', month: '2026-09', amount: 3300, items, dueDate: dueIn(-40), status: 'paid', paidOn: dueIn(-45), method: 'UPI', ref: 'X', lateFee: 0 },
    { id: 'bravi', flat: 'B-202', month: '2026-11', amount: 3300, items, dueDate: dueIn(5), status: 'due' }
  ] } });
});
test.after(() => server.close());

test('settings tell the app that online payment is on, without leaking any key', async () => {
  const s = (await call('GET', '/api/state', null, priya)).body.db.settings;
  assert.equal(s.payOnline, true);
  assert.ok(!JSON.stringify(s).includes(KEY_SECRET) && !JSON.stringify(s).includes(HOOK));
});

test('the server prices the order itself, adding the late fee for overdue bills', async () => {
  const r = await order(priya, ['bnov', 'boct']);
  assert.equal(r.status, 200);
  // 3300 current + 3300 overdue + 2% late fee (66) = 6666 rupees = 666600 paise
  assert.equal(r.body.amount, 666600);
  assert.equal(r.body.keyId, KEY_ID);
  assert.equal(r.body.test, true);
  assert.match(r.body.orderId, /^order_/);
  assert.equal(r.body.prefill.contact, '9876500001');
  const sent = razorpayCalls.at(-1);
  assert.equal(sent.url, 'https://api.razorpay.com/v1/orders');
  assert.equal(sent.auth, 'Basic ' + Buffer.from(KEY_ID + ':' + KEY_SECRET).toString('base64'));
  assert.equal(sent.body.amount, 666600);
  assert.equal(sent.body.currency, 'INR');
});

test('a browser cannot choose its own amount', async () => {
  const before = razorpayCalls.length;
  const r = await call('POST', '/api/payments/order', { billIds: ['bnov'], amount: 1, total: 1 }, priya);
  assert.equal(r.status, 200);
  assert.equal(r.body.amount, 330000);
  assert.equal(razorpayCalls.at(-1).body.amount, 330000);
  assert.equal(razorpayCalls.length, before + 1);
});

test('orders are refused for other flats, paid bills, empty lists, admin, pending users and strangers', async () => {
  assert.equal((await order(priya, ['bravi'])).status, 404, 'another flat');
  assert.equal((await order(priya, ['bsep'])).status, 409, 'already paid');
  assert.equal((await order(priya, [])).status, 400);
  assert.equal((await order(priya, 'bnov')).status, 400);
  assert.equal((await order(priya, ['nope'])).status, 404);
  assert.equal((await order(admin, ['bnov'])).status, 403);
  assert.equal((await call('POST', '/api/payments/order', { billIds: ['bnov'] })).status, 401);
  const pending = (await reg('New Person', '9876500009', 'C', '303')).body.token;
  assert.equal((await order(pending, ['bnov'])).status, 403);
});

test('a bad signature never marks a bill paid; a good one does, exactly once', async () => {
  const o = (await order(priya, ['bnov'])).body;
  const pay = 'pay_AAAA1111';
  const bad = await call('POST', '/api/payments/verify', { orderId: o.orderId, paymentId: pay, signature: 'deadbeef' }, priya);
  assert.equal(bad.status, 400);
  assert.equal((await bill('bnov', priya)).status, 'due');
  const swapped = await call('POST', '/api/payments/verify', { orderId: o.orderId, paymentId: 'pay_OTHER999', signature: sign(o.orderId, pay) }, priya);
  assert.equal(swapped.status, 400, 'signature is tied to the payment id');

  const ok = await call('POST', '/api/payments/verify', { orderId: o.orderId, paymentId: pay, signature: sign(o.orderId, pay) }, priya);
  assert.equal(ok.status, 200);
  const b = ok.body.db.bills.find(x => x.id === 'bnov');
  assert.equal(b.status, 'paid');
  assert.equal(b.method, 'Razorpay');
  assert.equal(b.ref, pay);
  assert.equal(b.lateFee, 0);
  assert.ok(b.paidOn);

  const notifsBefore = (await store.all('notifs')).length;
  const again = await call('POST', '/api/payments/verify', { orderId: o.orderId, paymentId: pay, signature: sign(o.orderId, pay) }, priya);
  assert.equal(again.status, 200);
  assert.equal((await store.all('notifs')).length, notifsBefore, 'second confirmation adds nothing');
  assert.ok((await store.all('notifs')).some(n => n.to === 'admin' && /A-101 paid/.test(n.text)), 'admin is told');
  assert.ok((await store.all('notifs')).some(n => n.to === priyaId && /received/.test(n.text)), 'resident is told');
});

test('another resident cannot confirm someone else\'s order', async () => {
  const o = (await order(priya, ['boct'])).body;
  const pay = 'pay_BBBB2222';
  const r = await call('POST', '/api/payments/verify', { orderId: o.orderId, paymentId: pay, signature: sign(o.orderId, pay) }, ravi);
  assert.equal(r.status, 404);
  assert.equal((await bill('boct', priya)).status, 'due');
});

test('webhook needs a valid signature, then settles the order even if the browser never came back', async () => {
  const o = (await order(priya, ['boct'])).body;
  const pay = { id: 'pay_CCCC3333', order_id: o.orderId, amount: o.amount, status: 'captured' };
  const event = { event: 'payment.captured', payload: { payment: { entity: pay } } };

  assert.equal((await hook(event, 'wrong_secret')).status, 400);
  assert.equal((await call('POST', '/api/payments/webhook', event)).status, 400, 'no signature');
  assert.equal((await bill('boct', priya)).status, 'due');

  assert.equal((await hook({ ...event, payload: { payment: { entity: { ...pay, amount: 100 } } } })).status, 200);
  assert.equal((await bill('boct', priya)).status, 'due', 'amount mismatch is not settled');
  assert.ok((await store.all('log')).some(l => /unexpected amount/.test(l.t)));

  assert.equal((await hook(event)).status, 200);
  const b = await bill('boct', priya);
  assert.equal(b.status, 'paid');
  assert.equal(b.ref, 'pay_CCCC3333');
  assert.equal(b.lateFee, 66, 'late fee at the time of the order is kept');
  assert.equal((await hook(event)).status, 200, 'Razorpay retries are harmless');
  assert.equal((await hook({ event: 'order.paid', payload: { payment: { entity: { id: 'pay_x', order_id: 'order_unknown', amount: 5 } } } })).status, 200, 'unknown orders are ignored');
});

test('if the admin already marked a bill paid, the online payment is flagged for a refund check', async () => {
  const o = (await order(ravi, ['bravi'])).body;
  await sync(admin, { bills: { upsert: [{ id: 'bravi', flat: 'B-202', month: '2026-11', amount: 3300, items: [], dueDate: dueIn(5), status: 'paid', paidOn: dueIn(0), method: 'Cash at office', ref: 'CASH', lateFee: 0 }] } });
  const pay = 'pay_DDDD4444';
  const r = await call('POST', '/api/payments/verify', { orderId: o.orderId, paymentId: pay, signature: sign(o.orderId, pay) }, ravi);
  assert.equal(r.status, 200);
  assert.equal((await bill('bravi', ravi)).method, 'Cash at office', 'the earlier record is not overwritten');
  assert.match((await store.get('payments', o.orderId)).note, /Check for a refund/);
  assert.ok((await store.all('notifs')).some(n => n.to === 'admin' && /refund/.test(n.text)));
});

test('residents still cannot mark bills paid through sync, and cannot claim the Razorpay method', async () => {
  await sync(admin, { bills: { upsert: [{ id: 'bx', flat: 'A-101', month: '2026-12', amount: 3300, items: [], dueDate: dueIn(20), status: 'due' }] } });
  const r = await sync(priya, { bills: { upsert: [{ id: 'bx', status: 'paid', method: 'Razorpay', ref: 'pay_FAKE' }] } });
  assert.equal(r.status, 200);
  assert.equal((await bill('bx', priya)).status, 'due');
  const r2 = await sync(priya, { bills: { upsert: [{ id: 'bx', status: 'verifying', method: 'Razorpay', ref: 'pay_FAKE' }] } });
  assert.ok(r2.body.rejected.length, 'Razorpay is not a method residents can pick');
  assert.equal((await bill('bx', priya)).status, 'due');
});

test('payment records are never sent to the browser', async () => {
  for (const t of [priya, admin]) {
    const db = (await call('GET', '/api/state', null, t)).body.db;
    assert.equal(db.payments, undefined);
  }
});

test('without Razorpay keys the app says so and the routes stay closed', async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'x'.repeat(40) });
  const s2 = createApp({ store, config, razorpay: null });
  await new Promise(r => s2.listen(0, r));
  const b2 = 'http://127.0.0.1:' + s2.address().port;
  const login = await (await fetch(b2 + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'admin', password: 'adminpass1' }) })).json();
  const st = await (await fetch(b2 + '/api/state', { headers: { Authorization: 'Bearer ' + login.token } })).json();
  assert.equal(st.db.settings.payOnline, false);
  const o = await fetch(b2 + '/api/payments/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + priya }, body: JSON.stringify({ billIds: ['bx'] }) });
  assert.equal(o.status, 503);
  s2.close();
});

test('the key secret is required together with the key id', () => {
  assert.throws(() => load({ RAZORPAY_KEY_ID: 'rzp_test_x', JWT_SECRET: 'x'.repeat(40) }), /RAZORPAY_KEY_SECRET/);
  assert.equal(razorpay.fromConfig(load({ JWT_SECRET: 'x'.repeat(40) })), null);
});
