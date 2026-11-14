'use strict';
const http = require('http');
const crypto = require('crypto');
const { load } = require('./lib/config');
const store_ = require('./lib/store');
const auth = require('./lib/auth');
const { bootstrap } = require('./lib/bootstrap');
const rules = require('./lib/rules');
const razorpayLib = require('./lib/razorpay');
const payments = require('./lib/payments');
const files = require('./lib/files');

const { COLLS, HttpError, viewFor, publicView, applyChanges, flatKey, sanitize, str, canAct } = rules;

/* razorpay: pass a client to override (tests do), null to turn online payments off, leave out to read the environment. */
function createApp({ store, config, razorpay }) {
  const rzp = razorpay === undefined ? razorpayLib.fromConfig(config) : razorpay;
  const payLimit = auth.limiter(20, 10 * 60e3);
  const loginLimit = auth.limiter(10, 15 * 60e3);
  const regLimit = auth.limiter(10, 60 * 60e3);
  const ipLimit = auth.limiter(300, 60e3);

  const localOrigin = o => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || o === 'capacitor://localhost' || o === 'https://localhost';
  const originOk = o => !!o && (config.origins.includes('*') || config.origins.includes(o) || o === 'https://localhost' || o === 'capacitor://localhost' || (!config.prod && localOrigin(o)));

  const send = (res, status, body, extra = {}) => {
    const buf = Buffer.from(JSON.stringify(body));
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store', ...extra });
    res.end(buf);
  };

  function readRaw(req, limit = 6 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'That request is too large.')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  async function readJson(req, limit) {
    const raw = await readRaw(req, limit);
    if (!raw.length) return {};
    try { const v = JSON.parse(raw.toString('utf8')); return v && typeof v === 'object' ? v : {}; }
    catch (e) { throw new HttpError(400, 'Request body is not valid JSON.'); }
  }

  const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const session = u => u.role === 'admin' ? { k: 'admin', username: u.username } : { k: 'user', id: u.id };
  const token = u => auth.sign({ sub: u.id, pa: u.pwdAt || 0, exp: Math.floor(Date.now() / 1000) + config.tokenDays * 86400 }, config.jwtSecret);

  async function actorOf(req) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const pl = m && auth.verify(m[1], config.jwtSecret);
    if (!pl) throw new HttpError(401, 'Please sign in again.');
    const u = await store.get('users', pl.sub);
    if (!u || (u.pwdAt || 0) !== (pl.pa || 0)) throw new HttpError(401, 'Please sign in again.');
    return u;
  }
  const needAdmin = u => { if (u.role !== 'admin') throw new HttpError(403, 'Admin only.'); };

  async function loadData() {
    const data = { settings: { ...((await store.get('settings', 'settings')) || {}), payOnline: !!rzp, payTest: !!(rzp && rzp.testMode) } };
    for (const c of COLLS) data[c] = await store.all(c);
    return data;
  }

  async function addNotifyAndLog(text, link, logText) {
    const now = Date.now();
    await store.put('notifs', { id: 'n' + crypto.randomBytes(5).toString('hex'), to: 'admin', text, link, at: now, read: [] });
    if (logText) await store.put('log', { id: 'l' + crypto.randomBytes(5).toString('hex'), t: logText, at: now });
  }

  /* ---------------- routes ---------------- */
  const routes = {
    'GET /api/health': async () => [200, { ok: true, db: store.kind, time: new Date().toISOString() }],

    'GET /api/rev': async () => [200, { rev: await store.rev() }],

    'GET /api/public': async () => [200, { db: publicView(await loadData()), rev: await store.rev() }],

    'POST /api/auth/login': async (req) => {
      const b = await readJson(req, 20000);
      const idf = str(b.id, 120).trim().toLowerCase(), pw = str(b.password, 200);
      if (!idf || !pw) throw new HttpError(400, 'Enter your mobile number or email and your password.');
      const key = clientIp(req) + '|' + idf;
      if (!loginLimit.check(key)) throw new HttpError(429, 'Too many attempts. Wait a few minutes and try again.');
      const users = await store.all('users');
      const u = users.find(x => x.role === 'admin' ? x.username === idf : (x.mobile === idf || (x.email && String(x.email).toLowerCase() === idf)));
      // Always run one password check so response time does not reveal whether the account exists.
      const ok = await auth.verifyPassword(pw, u ? u.pass : 's1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==');
      if (!u || !ok) throw new HttpError(401, 'Mobile, email or password is incorrect.');
      loginLimit.clear(key);
      return [200, { token: token(u), session: session(u) }];
    },

    'POST /api/auth/register': async (req) => {
      if (!regLimit.check(clientIp(req))) throw new HttpError(429, 'Too many registrations from this network. Try again later.');
      const b = await readJson(req, 50000);
      const name = str(b.name, 80).trim(), mobile = str(b.mobile, 10).trim(), pw = str(b.password, 200);
      const tower = str(b.tower, 2).trim().toUpperCase(), flat = str(b.flat, 5).trim();
      const type = ['Owner', 'Tenant', 'Family member'].includes(b.type) ? b.type : 'Owner';
      if (name.length < 3) throw new HttpError(400, 'Enter your full name.');
      if (!/^[6-9]\d{9}$/.test(mobile)) throw new HttpError(400, 'Enter a valid 10 digit Indian mobile number.');
      if (pw.length < 6) throw new HttpError(400, 'Password needs at least 6 characters.');
      if (!/^[A-Z]$/.test(tower) || !/^\d{3,4}$/.test(flat)) throw new HttpError(400, 'Choose your tower and flat number.');
      const users = await store.all('users');
      if (users.some(u => u.mobile === mobile)) throw new HttpError(409, 'This mobile number is already registered. Sign in instead.');
      if (type === 'Owner' && users.some(u => u.role !== 'admin' && u.tower === tower && u.flat === flat && u.type === 'Owner' && u.status === 'approved'))
        throw new HttpError(409, `${tower}-${flat} already has an approved owner. Register as Tenant or Family member, or contact the office.`);
      const u = {
        id: 'u' + crypto.randomBytes(6).toString('hex'), name, tower, flat, mobile, email: str(b.email, 120).trim(), type,
        status: 'pending', role: 'resident', title: '', members: Math.min(12, Math.max(1, Number(b.members) || 1)), vehicle: '',
        showPhone: false, ref: str(b.ref, 120).trim(), created: Date.now(), pass: await auth.hashPassword(pw), pwdAt: Date.now()
      };
      await store.put('users', u);
      await addNotifyAndLog(`New registration request from ${name} (${tower}-${flat})`, 'members', `${name} registered for ${tower}-${flat}`);
      return [201, { token: token(u), session: session(u) }];
    },

    'GET /api/state': async (req) => {
      const u = await actorOf(req);
      return [200, { db: viewFor(u, await loadData()), session: session(u), rev: await store.rev() }];
    },

    'POST /api/sync': async (req) => {
      const u = await actorOf(req);
      const b = await readJson(req);
      const result = await applyChanges(u, store, b.changes);
      if (u.role === 'admin' && b.changes && (b.changes.notices || b.changes.events)) files.sweep(store).catch(e => console.error('file sweep', e));
      const fresh = await store.get('users', u.id);
      return [200, { db: viewFor(fresh || u, await loadData()), rejected: result.rejected, applied: result.applied, rev: await store.rev() }];
    },

    /* ---- online payments (Razorpay) ---- */
    'POST /api/payments/order': async (req) => {
      const u = await actorOf(req);
      if (!rzp) throw new HttpError(503, 'Online payment is not switched on for this society yet.');
      if (u.role === 'admin' || u.status !== 'approved') throw new HttpError(403, 'Only approved residents can pay bills.');
      if (!payLimit.check(u.id)) throw new HttpError(429, 'Too many payment attempts. Wait a few minutes and try again.');
      const b = await readJson(req, 20000);
      const settings = (await store.get('settings', 'settings')) || {};
      return [200, await payments.createPaymentOrder({ store, rzp, user: u, billIds: b.billIds, settings })];
    },

    'POST /api/payments/verify': async (req) => {
      const u = await actorOf(req);
      if (!rzp) throw new HttpError(503, 'Online payment is not switched on for this society yet.');
      const b = await readJson(req, 20000);
      const orderId = str(b.orderId, 64), paymentId = str(b.paymentId, 64), signature = str(b.signature, 128);
      if (!/^[A-Za-z0-9_]{5,64}$/.test(orderId) || !/^[A-Za-z0-9_]{5,64}$/.test(paymentId)) throw new HttpError(400, 'That payment confirmation is not valid.');
      const p = await store.get('payments', orderId);
      if (!p || (p.userId !== u.id && p.flat !== flatKey(u))) throw new HttpError(404, 'We could not find that payment.');
      if (!rzp.verifyPayment(orderId, paymentId, signature)) throw new HttpError(400, 'The payment could not be verified. If money was deducted, it will show here within a few minutes.');
      await payments.settle({ store, orderId, paymentId, via: 'browser' });
      const fresh = await store.get('users', u.id);
      return [200, { ok: true, db: viewFor(fresh || u, await loadData()), session: session(fresh || u), rev: await store.rev() }];
    },

    'POST /api/payments/webhook': async (req) => {
      if (!rzp || !rzp.hasWebhook) throw new HttpError(503, 'Webhook is not configured.');
      const raw = await readRaw(req, 1024 * 1024);
      if (!rzp.verifyWebhook(raw, req.headers['x-razorpay-signature'])) throw new HttpError(400, 'Bad signature.');
      let event;
      try { event = JSON.parse(raw.toString('utf8')); } catch (e) { throw new HttpError(400, 'Bad body.'); }
      await payments.handleWebhook({ store, event });
      return [200, { ok: true }];
    },


    /* ---- file attachments for notices and events ---- */
    'POST /api/files': async (req) => {
      const u = await actorOf(req); needAdmin(u);
      // base64 is about a third bigger than the file, so allow a little over 5 MB x 4/3 here; files.check enforces the real limit
      const b = await readJson(req, Math.ceil(files.FILE_MAX * 4 / 3) + 4096);
      const file = await files.put(store, u.id, b);
      return [201, { file }];
    },

    /* ---- security guards: only the admin creates them ---- */
    'POST /api/admin/security': async (req) => {
      const u = await actorOf(req); needAdmin(u);
      const b = await readJson(req, 20000);
      const name = str(b.name, 80).trim(), mobile = str(b.mobile, 10).trim(), pw = str(b.password, 200);
      if (name.length < 3) throw new HttpError(400, 'Enter the guard\'s full name.');
      if (!/^[6-9]\d{9}$/.test(mobile)) throw new HttpError(400, 'Enter a valid 10 digit mobile number.');
      if (pw.length < 6) throw new HttpError(400, 'Password needs at least 6 characters.');
      const users = await store.all('users');
      if (users.some(x => x.mobile === mobile)) throw new HttpError(409, 'This mobile number is already used by another account.');
      const g = { id: 'g' + crypto.randomBytes(6).toString('hex'), name, tower: '', flat: '', mobile, email: '', type: 'Security', status: 'staff', role: 'security',
        title: 'Security', members: 1, vehicle: '', showPhone: false, ref: '', created: Date.now(), pass: await auth.hashPassword(pw), pwdAt: Date.now() };
      await store.put('users', g);
      await addNotifyAndLog(`Security guard ${name} was added`, 'members', `Added security guard ${name}`);
      return [201, { id: g.id }];
    },

    'POST /api/auth/password': async (req) => {
      const u = await actorOf(req);
      const b = await readJson(req, 20000);
      const min = u.role === 'admin' ? 8 : 6;
      if (!(await auth.verifyPassword(str(b.current, 200), u.pass))) throw new HttpError(400, 'Current password is incorrect.');
      const next = str(b.next, 200);
      if (next.length < min) throw new HttpError(400, `New password needs at least ${min} characters.`);
      if (u.role === 'admin' && b.username != null) {
        const nu = str(b.username, 40).trim().toLowerCase();
        if (nu.length < 3 || /\s/.test(nu)) throw new HttpError(400, 'Admin username needs at least 3 characters and no spaces.');
        u.username = nu;
      }
      u.pass = await auth.hashPassword(next);
      u.pwdAt = Date.now();
      await store.put('users', u);
      return [200, { token: token(u), session: session(u) }];
    },

    'POST /api/auth/withdraw': async (req) => {
      const u = await actorOf(req);
      if (u.role === 'admin' || u.status === 'approved') throw new HttpError(400, 'Approved accounts cannot be withdrawn here.');
      await store.del('users', u.id);
      return [200, { ok: true }];
    }
  };

  async function handle(req, res) {
    const origin = req.headers.origin;
    if (origin && originOk(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const url = new URL(req.url, 'http://x');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (!ipLimit.check(clientIp(req))) return send(res, 429, { error: 'Too many requests. Slow down.' });

    try {
      let h = routes[req.method + ' ' + path];
      let params = null;
      const m = /^\/api\/admin\/users\/([A-Za-z0-9_-]{1,64})\/password$/.exec(path);
      if (!h && req.method === 'POST' && m) { params = { id: m[1] }; h = resetPassword; }
      const fl = /^\/api\/files\/([A-Za-z0-9_-]{1,64})\/link$/.exec(path), fg = /^\/api\/files\/([A-Za-z0-9_-]{1,64})$/.exec(path);
      if (!h && req.method === 'POST' && fl) { params = { id: fl[1] }; h = fileLink; }
      if (!h && req.method === 'GET' && fg) return serveFile(req, res, fg[1], url);
      if (!h) return send(res, 404, { error: 'Not found.' });
      const [status, body] = await h(req, params);
      send(res, status, body);
    } catch (e) {
      if (e instanceof HttpError || (e && e.client && e.status)) return send(res, e.status, { error: e.message });
      console.error(e);
      send(res, 500, { error: 'Something went wrong on the server. Try again.' });
    }
  }

  /* A resident (or the admin) asks for a link to one file. The link is signed for that file only and expires in 10 minutes,
     so it can be opened in a new tab, a PDF viewer or the Android download manager without sending the login token. */
  async function fileLink(req, params) {
    const u = await actorOf(req);
    if (!canAct(u)) throw new HttpError(403, 'Your registration is not approved yet.');
    const f = await files.get(store, params.id);
    if (!f) throw new HttpError(404, 'That file is no longer available.');
    const t = auth.sign({ ft: f.id, exp: Math.floor(Date.now() / 1000) + 600 }, config.jwtSecret);
    return [200, { url: '/api/files/' + f.id + '?t=' + encodeURIComponent(t), inline: !!f.inline, name: f.name, mime: f.mime }];
  }

  async function serveFile(req, res, id, url) {
    const pl = auth.verify(url.searchParams.get('t'), config.jwtSecret);
    if (!pl || pl.ft !== id) return send(res, 403, { error: 'This link has expired. Open the file again.' });
    const f = await files.get(store, id);
    if (!f) return send(res, 404, { error: 'That file is no longer available.' });
    const dl = url.searchParams.get('dl') === '1' || !f.inline;
    res.writeHead(200, {
      'Content-Type': f.mime, 'Content-Length': f.buf.length,
      'Content-Disposition': (dl ? 'attachment; ' : 'inline; ') + files.dispositionName(f.name),
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });
    res.end(f.buf);
  }

  async function resetPassword(req, params) {
    const a = await actorOf(req); needAdmin(a);
    const u = await store.get('users', params.id);
    if (!u || u.role === 'admin') throw new HttpError(404, 'Resident not found.');
    const temp = auth.tempPassword(10);
    u.pass = await auth.hashPassword(temp);
    u.pwdAt = Date.now();
    await store.put('users', u);
    return [200, { password: temp }];
  }

  return http.createServer((req, res) => { handle(req, res); });
}

async function main() {
  const config = load();
  const store = store_.create(config);
  await store.init();
  await bootstrap(store, config);
  const server = createApp({ store, config });
  server.listen(config.port, () => console.log(`Queenstown API listening on ${config.port} (${store.kind})`));
  const stop = () => { server.close(() => store.close().finally(() => process.exit(0))); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}

if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1); });

module.exports = { createApp };
