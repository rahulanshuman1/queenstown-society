'use strict';
const crypto = require('crypto');
const util = require('util');
const scrypt = util.promisify(crypto.scrypt);

const SCRYPT = { N: 16384, r: 8, p: 1 };

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pw), salt, 64, SCRYPT);
  return 's1$' + salt.toString('base64') + '$' + key.toString('base64');
}

async function verifyPassword(pw, stored) {
  const [v, s, k] = String(stored || '').split('$');
  if (v !== 's1' || !s || !k) return false;
  const want = Buffer.from(k, 'base64');
  const got = await scrypt(String(pw), Buffer.from(s, 'base64'), want.length, SCRYPT);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

const b64u = x => Buffer.from(x).toString('base64url');

function sign(payload, secret) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const s = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + s;
}

function verify(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const want = crypto.createHmac('sha256', secret).update(h + '.' + p).digest();
  const got = Buffer.from(s, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try {
    const head = JSON.parse(Buffer.from(h, 'base64url').toString());
    const pl = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (head.alg !== 'HS256') return null;
    if (!pl.exp || pl.exp < Date.now() / 1000) return null;
    return pl;
  } catch (e) { return null; }
}

/* Fixed window counter. check() returns false once the limit is passed. */
function limiter(max, windowMs) {
  const m = new Map();
  return {
    check(key) {
      const now = Date.now();
      let e = m.get(key);
      if (!e || e.reset < now) { e = { n: 0, reset: now + windowMs }; m.set(key, e); }
      e.n++;
      if (m.size > 5000) for (const [k, v] of m) if (v.reset < now) m.delete(k);
      return e.n <= max;
    },
    clear(key) { m.delete(key); }
  };
}

const TEMP_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function tempPassword(len = 10) {
  let s = '';
  const b = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) s += TEMP_CHARS[b[i] % TEMP_CHARS.length];
  return s;
}

module.exports = { hashPassword, verifyPassword, sign, verify, limiter, tempPassword };
