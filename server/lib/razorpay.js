'use strict';
/* Thin Razorpay client. No SDK needed: orders go through the REST API and
   signatures are plain HMAC-SHA256, so the server has no extra dependency.
   The key secret and webhook secret stay on the server and are never sent to the browser. */
const crypto = require('crypto');
const { HttpError } = require('./rules');

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function create({ keyId, keySecret, webhookSecret }, fetchImpl = globalThis.fetch) {
  const auth = 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64');
  return {
    keyId,
    testMode: /^rzp_test_/.test(keyId),
    hasWebhook: !!webhookSecret,

    /* amountPaise is an integer in paise. Returns the Razorpay order object. */
    async createOrder({ amountPaise, receipt, notes }) {
      let r, j = {};
      try {
        r = await fetchImpl('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
          signal: AbortSignal.timeout(15000)
        });
        j = await r.json().catch(() => ({}));
      } catch (e) {
        console.error('Razorpay order request failed:', e.message);
        throw new HttpError(502, 'The payment service is not reachable. Try again in a moment.');
      }
      if (!r.ok || !j.id) {
        console.error('Razorpay refused the order:', r.status, j && j.error && j.error.description);
        throw new HttpError(502, 'The payment service could not start this payment. Try again, or contact the society office.');
      }
      return j;
    },

    /* Checks the signature Razorpay Checkout returns to the browser after a payment. */
    verifyPayment(orderId, paymentId, signature) {
      return !!orderId && !!paymentId && !!signature && safeEqual(hmac(keySecret, orderId + '|' + paymentId), signature);
    },

    /* Checks the X-Razorpay-Signature header of a webhook against the raw request body. */
    verifyWebhook(rawBody, signature) {
      return !!webhookSecret && !!signature && safeEqual(hmac(webhookSecret, rawBody), signature);
    }
  };
}

/* Returns null when Razorpay is not configured, so the app falls back to manual payments. */
function fromConfig(cfg) {
  if (!cfg.razorpayKeyId || !cfg.razorpayKeySecret) return null;
  return create({ keyId: cfg.razorpayKeyId, keySecret: cfg.razorpayKeySecret, webhookSecret: cfg.razorpayWebhookSecret });
}

module.exports = { create, fromConfig, hmac };
