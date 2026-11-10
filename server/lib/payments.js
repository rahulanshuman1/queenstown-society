'use strict';
/* Online maintenance payments.
   The browser never decides an amount or marks a bill paid. The server prices the bills itself,
   asks Razorpay for an order, and only marks bills paid after the signed confirmation (or the signed webhook). */
const crypto = require('crypto');
const { HttpError, flatKey, isId } = require('./rules');

const rid = p => p + crypto.randomBytes(5).toString('hex');
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

const lateOf = (b, settings, now) =>
  +new Date(b.dueDate) < now ? Math.round(b.amount * (Number(settings.latePct) || 0) / 100) : 0;

/* One writer at a time per order, so the browser confirmation and the webhook cannot both settle it. */
const chains = new Map();
function withLock(key, fn) {
  const run = (chains.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  chains.set(key, run);
  run.catch(() => {}).finally(() => { if (chains.get(key) === run) chains.delete(key); });
  return run;
}

/* Prices the selected bills for this resident's flat. Late fee is added when the due date has passed. */
async function priceBills({ store, user, billIds, settings, now }) {
  if (!Array.isArray(billIds) || !billIds.length || billIds.length > 24) throw new HttpError(400, 'Choose the bills you want to pay.');
  const fk = flatKey(user), seen = new Set(), items = [];
  for (const id of billIds) {
    if (!isId(id) || seen.has(id)) continue;
    seen.add(id);
    const b = await store.get('bills', id);
    if (!b || b.flat !== fk) throw new HttpError(404, 'One of those bills was not found. Refresh the page and try again.');
    if (b.status === 'paid') throw new HttpError(409, 'A bill you selected is already paid. Refresh the page.');
    items.push({ billId: b.id, month: b.month, amount: Number(b.amount) || 0, late: lateOf(b, settings, now) });
  }
  const total = items.reduce((a, i) => a + i.amount + i.late, 0);
  if (!items.length || total < 1) throw new HttpError(400, 'There is nothing to pay on those bills.');
  return { items, total, fk };
}

async function createPaymentOrder({ store, rzp, user, billIds, settings, now = Date.now() }) {
  const { items, total, fk } = await priceBills({ store, user, billIds, settings, now });
  const amountPaise = Math.round(total * 100);
  const order = await rzp.createOrder({
    amountPaise,
    receipt: 'qs_' + crypto.randomBytes(8).toString('hex'),
    notes: { flat: fk, user: user.id, months: items.map(i => i.month).join(',').slice(0, 200) }
  });
  await store.put('payments', {
    id: order.id, orderId: order.id, userId: user.id, flat: fk, items, total, amountPaise,
    status: 'created', createdAt: now
  });
  return {
    orderId: order.id, amount: amountPaise, currency: 'INR', keyId: rzp.keyId, test: rzp.testMode,
    name: settings.name || 'Queenstown Society',
    description: 'Maintenance ' + fk + ' · ' + items.map(i => i.month).join(', '),
    prefill: { name: user.name || '', contact: user.mobile || '', email: user.email || '' },
    total
  };
}

/* Marks the bills of an order as paid. Safe to call twice. Returns the payment record, or null if unknown. */
function settle({ store, orderId, paymentId, via, now = Date.now() }) {
  return withLock(orderId, async () => {
    const p = await store.get('payments', orderId);
    if (!p) return null;
    if (p.status === 'paid') return p;
    const paidOn = new Date(now).toISOString(), skipped = [];
    for (const it of p.items) {
      const b = await store.get('bills', it.billId);
      if (!b || b.status === 'paid') { skipped.push(it.month); continue; }
      await store.put('bills', { ...b, status: 'paid', paidOn, method: 'Razorpay', ref: paymentId, orderId, lateFee: it.late });
    }
    p.status = 'paid'; p.paymentId = paymentId; p.paidAt = now; p.via = via;
    if (skipped.length) p.note = 'These bills were already paid or removed: ' + skipped.join(', ') + '. Check for a refund.';
    await store.put('payments', p);

    await store.put('notifs', { id: rid('n'), to: p.userId, text: `Payment of ${inr(p.total)} received for ${p.flat}. Your receipt is ready.`, link: 'maintenance', at: now, read: [] });
    await store.put('notifs', { id: rid('n'), to: 'admin', text: `${p.flat} paid ${inr(p.total)} online (Razorpay)` + (skipped.length ? '. Some bills were already paid, check for a refund.' : ''), link: 'billing', at: now, read: [] });
    await store.put('log', { id: rid('l'), t: `${p.flat} paid ${inr(p.total)} online, payment ${paymentId}`, at: now });
    return p;
  });
}

/* Webhook events from Razorpay. Returns nothing; unknown orders are ignored so Razorpay stops retrying. */
async function handleWebhook({ store, event, now = Date.now() }) {
  const name = event && event.event;
  const pl = (event && event.payload) || {};
  const pay = pl.payment && pl.payment.entity, ord = pl.order && pl.order.entity;
  const orderId = (pay && pay.order_id) || (ord && ord.id);
  if (!orderId) return;
  const p = await store.get('payments', orderId);
  if (!p) return;
  if (name === 'payment.captured' || name === 'order.paid') {
    if (!pay || !pay.id) return;
    if (pay.amount !== p.amountPaise) {
      console.error('Webhook amount mismatch for', orderId, pay.amount, p.amountPaise);
      await store.put('log', { id: rid('l'), t: `Payment ${pay.id} for ${p.flat} has an unexpected amount. Check the Razorpay dashboard.`, at: now });
      return;
    }
    await settle({ store, orderId, paymentId: pay.id, via: 'webhook', now });
  } else if (name === 'payment.failed' && p.status !== 'paid') {
    p.lastError = String((pay && pay.error_description) || 'Payment failed').slice(0, 200);
    await store.put('payments', p);
  }
}

module.exports = { createPaymentOrder, settle, handleWebhook, priceBills, lateOf };
