'use strict';
/* Who can see what (viewFor) and who can change what (applyChanges).
   The browser sends whole documents; this layer decides which parts are accepted.
   Residents never get to set fields like status, amount, userId or fee on their own. */

const files = require('./files');
const COLLS = ['users', 'notices', 'events', 'bills', 'schedule', 'amenities', 'bookings', 'complaints',
  'ads', 'polls', 'docs', 'contacts', 'entries', 'visitors', 'notifs', 'log'];
// The browser keeps these newest first (it uses unshift), the others oldest first.
const UNSHIFT = new Set(['complaints', 'visitors', 'ads', 'polls', 'docs', 'notifs', 'log']);

const str = (v, max) => String(v == null ? '' : v).slice(0, max);
const isId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const num = (v, min, max, def) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
const iso = v => { const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
const flatKey = u => u.tower + '-' + u.flat;
const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function sanitize(v, depth = 0) {
  if (depth > 8) throw new Error('Data is nested too deeply.');
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('Bad number.'); return v; }
  if (typeof v === 'string') { if (v.length > 1500000) throw new Error('Text is too long.'); return v; }
  if (Array.isArray(v)) { if (v.length > 2000) throw new Error('List is too long.'); return v.map(x => sanitize(x, depth + 1)); }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length > 500) throw new Error('Too many fields.');
    const o = {};
    for (const k of keys) {
      if (!/^[^$.\u0000]{1,100}$/.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') throw new Error('Bad field name.');
      o[k] = sanitize(v[k], depth + 1);
    }
    return o;
  }
  throw new Error('Bad value.');
}

/* ---------- reading ---------- */

const hasSecret = k => k === 'pass' || k === 'passHash' || k === 'pwdAt';
function userSafe(u) { const o = {}; for (const k in u) if (!hasSecret(k)) o[k] = u[k]; return o; }
function userDirectory(u) {
  return {
    id: u.id, name: u.name, tower: u.tower, flat: u.flat, type: u.type, role: u.role, title: u.title || '',
    status: u.status, members: u.members, showPhone: !!u.showPhone, created: u.created,
    mobile: u.showPhone ? u.mobile : '', email: '', vehicle: ''
  };
}
function publicSettings(s) {
  const o = {};
  for (const k in (s || {})) if (k !== 'adminUser' && k !== 'adminHash' && k !== 'id') o[k] = s[k];
  return o;
}

/* data = { settings, users, notices, ... } straight from the store (settings is one document) */
function viewFor(actor, data, now = Date.now()) {
  const admin = actor.role === 'admin';
  const out = { v: 1, settings: publicSettings(data.settings) };
  for (const c of COLLS) out[c] = [];
  const guard = isGuard(actor), approved = canAct(actor);

  if (!approved) { out.users = [userSafe(actor)]; return out; }

  const fk = admin || guard ? '' : flatKey(actor);
  const aid = admin ? 'admin' : actor.id;

  for (const c of COLLS) {
    const rows = data[c] || [];
    let list;
    if (guard && !['users', 'notices', 'events', 'schedule', 'contacts', 'visitors', 'notifs'].includes(c)) { out[c] = []; continue; }
    switch (c) {
      case 'users':
        list = admin
          ? rows.filter(u => u.role !== 'admin').map(userSafe)
          : rows.filter(u => u.role !== 'admin' && (u.status === 'approved' || u.id === actor.id))
              .map(u => u.id === actor.id ? userSafe(u) : userDirectory(u));
        break;
      case 'bills':
        list = admin ? rows : rows.map(b => b.flat === fk ? b
          : { id: b.id, flat: '', month: b.month, amount: b.amount, status: b.status, dueDate: b.dueDate, lateFee: b.lateFee || 0, items: [], redacted: true });
        break;
      case 'bookings':
        list = admin ? rows : rows.map(b => b.userId === aid ? b
          : { id: b.id, amenityId: b.amenityId, date: b.date, slot: b.slot, status: b.status, userId: '', purpose: '', redacted: true });
        break;
      case 'complaints':
        list = admin ? rows : rows.filter(r => r.userId === aid);
        break;
      case 'visitors': {
        /* guards and the office see every visitor; photos older than two weeks are left out to keep the page light */
        const old = now - 14 * 86400e3;
        list = admin || guard ? rows.map(r => +new Date(r.date) < old && r.photo ? { ...r, photo: '' } : r) : rows.filter(r => r.userId === aid || (r.flat && r.flat === fk));
        break;
      }
      case 'ads':
        list = admin ? rows : rows.filter(a => a.status === 'live' || a.userId === aid);
        break;
      case 'polls':
        list = admin ? rows : rows.map(p => {
          const votes = {}; let i = 0;
          for (const k of Object.keys(p.votes || {})) votes[k === fk ? k : 'x' + (i++)] = p.votes[k];
          return { ...p, votes };
        });
        break;
      case 'notifs':
        list = admin ? rows : rows.filter(n => n.to === aid || n.to === 'all' || (guard && n.to === 'security'));
        break;
      case 'log':
        list = admin ? rows : [];
        break;
      default:
        list = rows;
    }
    out[c] = UNSHIFT.has(c) ? list.slice().reverse() : list;
  }
  return out;
}

/* What anyone can see before signing in: the landing hero and the 30 day forecast. */
function publicView(data, now = Date.now()) {
  const out = { v: 1, settings: {}, public: true };
  const s = publicSettings(data.settings);
  out.settings = { name: s.name, tagline: s.tagline, address: s.address, site: s.site };
  for (const c of COLLS) out[c] = [];
  const from = now - 3 * 3600e3, to = now + 60 * 86400e3;
  const ev = (data.events || []).filter(e => +new Date(e.date) >= from && +new Date(e.date) <= to)
    .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 8);
  out.events = ev.map(e => ({
    id: e.id, title: e.title, scene: e.scene, date: e.date, venue: e.venue, category: e.category,
    featured: !!e.featured, fee: 0, desc: '', rsvps: {}, photos: [], capacity: 0,
    cover: e.featured && typeof e.cover === 'string' && e.cover.length < 400000 ? e.cover : null
  }));
  out.schedule = (data.schedule || []).filter(x => +new Date(x.date) >= from && +new Date(x.date) <= to)
    .map(x => ({ id: x.id, title: x.title, date: x.date, kind: x.kind, note: x.note }));
  return out;
}

/* ---------- writing ---------- */
// Each rule gets (ctx, existing, incoming). upsert returns { doc } to store, { ok:true } to accept without change,
// or { err } to reject. remove returns { ok:true } to delete, { skip:true } to ignore, or { err }.

const adminOnly = {
  upsert: (c, ex, d) => c.admin ? { doc: d } : { err: 'Only the admin can change this.' },
  remove: c => c.admin ? { ok: true } : { err: 'Only the admin can delete this.' }
};


/* An attachment is only kept if the file really was uploaded; its name, type and size come from the upload record, not from the browser. */
async function attOf(store, a) {
  const c = files.cleanAtt(a);
  if (!c) return null;
  const meta = await store.get('files', c.id);
  return meta ? { id: meta.id, name: meta.name, mime: meta.mime, size: meta.size } : null;
}

const USER_STATUS = ['pending', 'approved', 'rejected', 'staff'];
/* Security guards are staff accounts: they sign in, but they are not residents (no flat, no bills). */
const isGuard = u => !!u && u.role === 'security';
const canAct = u => !!u && (u.role === 'admin' || u.status === 'approved' || (u.role === 'security' && u.status === 'staff'));
const VISITOR_PHOTO_MAX = 90000;
function cleanPhoto(v) { return typeof v === 'string' && v.length <= VISITOR_PHOTO_MAX && IMG_RE.test(v) ? v : ''; }
const digits = (v, max) => String(v == null ? '' : v).replace(/\D/g, '').slice(0, max);
async function tell(store, to, text, link, now) {
  await store.put('notifs', { id: 'n' + require('crypto').randomBytes(5).toString('hex'), to, text: str(text, 300), link, at: now, read: [] });
}
const PAY_METHODS = ['UPI', 'Bank transfer', 'Cheque', 'Cash at office'];

const RULES = {
  notices: {
    async upsert(c, ex, d) {
      if (c.admin) return { doc: { ...d, readBy: ex ? (ex.readBy || []) : [], attachment: await attOf(c.store, d.attachment) } };
      if (!ex) return { err: 'Notice not found.' };
      const rb = ex.readBy || [];
      if (Array.isArray(d.readBy) && d.readBy.includes(c.aid) && !rb.includes(c.aid)) return { doc: { ...ex, readBy: [...rb, c.aid] } };
      return { ok: true };
    },
    remove: adminOnly.remove
  },

  events: {
    async upsert(c, ex, d) {
      if (c.admin) return { doc: { ...d, rsvps: ex ? (ex.rsvps || {}) : {}, attachment: await attOf(c.store, d.attachment) } };
      if (!ex) return { err: 'Event not found.' };
      const r = { ...(ex.rsvps || {}) };
      const v = d.rsvps && d.rsvps[c.aid];
      if (v === 'yes' || v === 'maybe') r[c.aid] = v; else delete r[c.aid];
      return { doc: { ...ex, rsvps: r } };
    },
    remove: adminOnly.remove
  },

  users: {
    upsert(c, ex, d) {
      if (!ex) return { err: 'Residents join through registration.' };
      if (ex.role === 'admin') return { err: 'Not allowed.' };
      const n = { ...ex };
      if (c.admin) {
        for (const k of ['name', 'tower', 'flat', 'type', 'email', 'vehicle', 'ref']) if (k in d) n[k] = str(d[k], 120);
        if ('members' in d) n.members = num(d.members, 1, 12, 1);
        if ('showPhone' in d) n.showPhone = !!d.showPhone;
        if ('status' in d) { if (!USER_STATUS.includes(d.status)) return { err: 'Unknown status.' }; if (ex.role === 'security' ? !['staff', 'rejected'].includes(d.status) : d.status === 'staff') return { err: 'That status does not fit this account.' }; n.status = d.status; }
        if ('role' in d) { if (ex.role === 'security') { if (d.role !== 'security') return { err: 'Security staff keep their role.' }; } else { if (!['resident', 'committee'].includes(d.role)) return { err: 'Unknown role.' }; n.role = d.role; } }
        if ('title' in d) n.title = str(d.title, 40);
        if ('reason' in d) n.reason = str(d.reason, 300);
        return { doc: n };
      }
      if (ex.id !== c.actor.id) return { err: 'You can only edit your own profile.' };
      if ('name' in d && str(d.name, 80).trim().length >= 2) n.name = str(d.name, 80).trim();
      if ('email' in d) n.email = str(d.email, 120).trim();
      if ('members' in d) n.members = num(d.members, 1, 12, 1);
      if ('vehicle' in d) n.vehicle = str(d.vehicle, 40).trim();
      if ('showPhone' in d) n.showPhone = !!d.showPhone;
      return { doc: n };
    },
    remove: (c, ex) => c.admin && ex && ex.role !== 'admin' ? { ok: true } : { err: 'Not allowed.' }
  },

  bills: {
    upsert(c, ex, d) {
      if (c.admin) return { doc: d };
      if (!ex || ex.flat !== c.fk) return { err: 'That bill is not yours.' };
      if (d.status === 'verifying' && ex.status === 'due') {
        const method = str(d.method, 30), ref = str(d.ref, 60).trim();
        if (!PAY_METHODS.includes(method)) return { err: 'Unknown payment method.' };
        const overdue = +new Date(ex.dueDate) < c.now;
        const late = overdue ? Math.round(ex.amount * (Number(c.settings.latePct) || 0) / 100) : 0;
        return { doc: { ...ex, status: 'verifying', method, ref: ref || 'CASH', submittedOn: new Date(c.now).toISOString(), lateFee: late } };
      }
      return { ok: true };
    },
    remove: adminOnly.remove
  },

  bookings: {
    async upsert(c, ex, d) {
      if (c.admin) return { doc: d };
      if (ex) return { err: 'You cannot change a booking. Cancel it and book again.' };
      const am = await c.store.get('amenities', str(d.amenityId, 64));
      if (!am) return { err: 'Unknown amenity.' };
      const date = iso(d.date);
      if (!date) return { err: 'Pick a valid date.' };
      if (new Date(date).getTime() < c.now - 86400e3) return { err: 'Pick a date from today onwards.' };
      const slot = str(d.slot, 30);
      const all = await c.store.all('bookings');
      // The browser sends local midnight of the chosen day, so the same day is the same instant.
      if (all.some(b => b.amenityId === am.id && b.slot === slot && b.status !== 'rejected' && +new Date(b.date) === +new Date(date))) return { err: 'That slot is already taken.' };
      return { doc: { id: d.id, amenityId: am.id, userId: c.aid, date, slot, purpose: str(d.purpose, 200), status: 'pending', at: c.now } };
    },
    remove: (c, ex) => c.admin || (ex && ex.userId === c.aid) ? { ok: true } : { err: 'That booking is not yours.' }
  },

  complaints: {
    upsert(c, ex, d) {
      const incoming = Array.isArray(d.comments) ? d.comments : [];
      if (!ex) {
        // Residents always file as themselves.
        return { doc: {
          id: d.id, userId: c.admin ? str(d.userId || 'admin', 64) : c.aid, category: str(d.category, 40), title: str(d.title, 120),
          body: str(d.body, 2000), priority: d.priority === 'high' ? 'high' : 'normal', status: 'open',
          assignee: c.admin ? str(d.assignee, 80) : '', created: c.now, comments: []
        } };
      }
      const seen = new Set((ex.comments || []).map(x => x.at + '|' + x.text));
      const added = incoming.filter(x => x && typeof x.text === 'string' && !seen.has(x.at + '|' + x.text)).slice(0, 5)
        .map(x => ({ by: c.admin ? 'Society Office' : c.name, text: str(x.text, 1000), at: c.now, admin: c.admin }));
      if (c.admin) {
        return { doc: { ...ex, status: ['open', 'in-progress', 'resolved'].includes(d.status) ? d.status : ex.status,
          assignee: str(d.assignee, 80), comments: [...(ex.comments || []), ...added] } };
      }
      if (ex.userId !== c.aid) return { err: 'That ticket is not yours.' };
      // Residents can only close or reopen their own ticket. Assigning and "in progress" belong to the office.
      const status = ['open', 'resolved'].includes(d.status) ? d.status : ex.status;
      return { doc: { ...ex, status, comments: [...(ex.comments || []), ...added] } };
    },
    remove: adminOnly.remove
  },

  visitors: {
    async upsert(c, ex, d) {
      if (c.admin) return { doc: { ...d, photo: cleanPhoto(d.photo) } };

      /* ---- security guard at the gate ---- */
      if (c.guard) {
        if (!ex) {
          const u = await c.store.get('users', str(d.userId, 64));
          if (!u || u.role === 'admin' || u.role === 'security' || u.status !== 'approved') return { err: 'Choose the flat this visitor is going to.' };
          const name = str(d.name, 80).trim();
          if (name.length < 2) return { err: 'Enter the visitor name.' };
          const doc = { id: d.id, userId: u.id, name, phone: digits(d.phone, 12), purpose: str(d.purpose, 60).trim() || 'Visit', vehicle: str(d.vehicle, 30).trim(),
            photo: cleanPhoto(d.photo), flat: flatKey(u), date: new Date(c.now).toISOString(), code: '', status: 'waiting', by: c.actor.id, byName: str(c.actor.name, 60), created: c.now };
          /* everyone approved in that flat is asked, so whoever is home can answer */
          const mates = (await c.store.all('users')).filter(x => x.status === 'approved' && x.role !== 'admin' && x.role !== 'security' && x.tower === u.tower && x.flat === u.flat);
          for (const m of (mates.length ? mates : [u])) await tell(c.store, m.id, `${name} (${doc.purpose}) is at the gate for ${flatKey(u)}. Open Visitors to approve or deny.`, 'visitors', c.now);
          return { doc };
        }
        const to = d.status;
        if (to === 'entered' && ['expected', 'approved'].includes(ex.status)) {
          await tell(c.store, ex.userId, `${ex.name} has entered the gate.`, 'visitors', c.now);
          return { doc: { ...ex, status: 'entered', entryAt: c.now, enteredBy: str(c.actor.name, 60) } };
        }
        if (to === 'exited' && ex.status === 'entered') return { doc: { ...ex, status: 'exited', exitAt: c.now } };
        if (to === 'cancelled' && ex.status === 'waiting') return { doc: { ...ex, status: 'cancelled' } };
        return { ok: true };
      }

      /* ---- resident ---- */
      if (!ex) {
        const code = str(d.code, 6);
        if (!/^\d{6}$/.test(code)) return { err: 'Bad visitor code.' };
        const all = await c.store.all('visitors');
        if (all.some(v => v.code === code)) return { err: 'Please try again, that code was already used.' };
        const date = iso(d.date);
        if (!date) return { err: 'Pick a valid date.' };
        return { doc: { id: d.id, userId: c.aid, name: str(d.name, 80), purpose: str(d.purpose, 120), vehicle: str(d.vehicle, 30), date, code, status: 'expected' } };
      }
      const sameFlat = !!ex.flat && ex.flat === c.fk;
      if (ex.userId !== c.aid && !sameFlat) return { err: 'That visitor pass is not yours.' };
      if (d.status === 'cancelled' && ex.status === 'expected' && ex.userId === c.aid) return { doc: { ...ex, status: 'cancelled' } };
      if (ex.status === 'waiting' && (d.status === 'approved' || d.status === 'denied')) {
        await tell(c.store, 'security', `${flatKey(c.actor)} ${d.status === 'approved' ? 'approved' : 'denied'} ${ex.name}.`, 'gate', c.now);
        return { doc: { ...ex, status: d.status, decidedAt: c.now, decidedBy: str(c.actor.name, 60) } };
      }
      return { ok: true };
    },
    remove: (c, ex) => c.admin || (!c.guard && ex && ex.userId === c.aid) ? { ok: true } : { err: 'That visitor pass is not yours.' }
  },

  ads: {
    upsert(c, ex, d) {
      if (c.admin) return { doc: d };
      if (ex) return { ok: true };
      const banner = d.type === 'banner';
      const weeks = banner ? Math.round(num(d.weeks, 1, 26, 1)) : 0;
      return { doc: {
        id: d.id, userId: c.aid, business: str(d.business, 80), title: str(d.title, 120), body: str(d.body, 1000),
        category: str(d.category, 40), contact: str(d.contact, 40), price: str(d.price, 60), type: banner ? 'banner' : 'classified',
        weeks, fee: banner ? weeks * (Number((c.settings.adRates || {}).banner) || 0) : 0, feePaid: !banner, status: 'pending',
        hue: /^#[0-9a-fA-F]{6}$/.test(d.hue || '') ? d.hue : '#E39A1B', created: c.now
      } };
    },
    remove: (c, ex) => c.admin || (ex && ex.userId === c.aid) ? { ok: true } : { err: 'That ad is not yours.' }
  },

  polls: {
    upsert(c, ex, d) {
      if (c.admin) return { doc: { ...d, votes: ex ? (ex.votes || {}) : {} } };
      if (!ex) return { err: 'Poll not found.' };
      if (ex.status !== 'open' || +new Date(ex.closes) < c.now) return { err: 'This poll is closed.' };
      const mine = d.votes ? d.votes[c.fk] : undefined;
      const i = Number(mine);
      if (!Number.isInteger(i) || i < 0 || i >= (ex.options || []).length) return { ok: true };
      if ((ex.votes || {})[c.fk] !== undefined) return { ok: true };
      return { doc: { ...ex, votes: { ...(ex.votes || {}), [c.fk]: i } } };
    },
    remove: adminOnly.remove
  },

  notifs: {
    upsert(c, ex, d) {
      if (c.admin) return { doc: { ...d, read: union(ex && ex.read, d.read) } };
      if (!ex) {
        if (d.to !== 'admin') return { err: 'Not allowed.' };
        return { doc: { id: d.id, to: 'admin', text: str(d.text, 300), link: str(d.link, 30), at: c.now, read: [] } };
      }
      if (ex.to !== c.aid && ex.to !== 'all' && !(c.guard && ex.to === 'security')) return { err: 'Not allowed.' };
      if (Array.isArray(d.read) && d.read.includes(c.aid) && !(ex.read || []).includes(c.aid)) return { doc: { ...ex, read: [...(ex.read || []), c.aid] } };
      return { ok: true };
    },
    remove: c => c.admin ? { ok: true } : { skip: true }
  },

  log: {
    upsert: (c, ex, d) => c.admin ? { doc: { id: d.id, t: str(d.t, 300), at: Number(d.at) || c.now } } : { ok: true },
    remove: c => c.admin ? { ok: true } : { skip: true }
  },

  schedule: adminOnly, amenities: adminOnly, docs: adminOnly, contacts: adminOnly, entries: adminOnly
};

const SETTINGS_FIELDS = ['name', 'tagline', 'address', 'upi', 'upiName', 'bank', 'bankDetails', 'payMethods', 'charges', 'dueDay', 'latePct', 'adRates', 'demo', 'site'];

/* ---- site look and content (logo, festive theme, website text, footer) ----
   Everything here is shown to visitors before they sign in, so it is checked field by field.
   Text is escaped by the app when drawn; links must be web addresses; images must be small PNG, JPEG or WebP data. */
const FESTIVALS = ['none', 'diwali', 'holi', 'christmas', 'newyear', 'republic', 'eid', 'navratri', 'ganesh', 'custom'];
const IMG_RE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const LOGO_MAX = 400000, PHOTO_MAX = 500000;
function cleanImg(v, max, what) {
  if (v == null || v === '') return '';
  if (typeof v !== 'string' || v.length > max || !IMG_RE.test(v)) throw new Error('The ' + what + ' is too large or is not a PNG, JPEG or WebP image.');
  return v;
}
const cleanUrl = v => { v = str(v, 300).trim(); return /^(?:https?:\/\/[^\s<>"']+|#[A-Za-z0-9\/_-]{0,40})$/i.test(v) ? v : ''; };
const cleanWebUrl = v => { v = cleanUrl(v); return v.startsWith('#') ? '' : v; };
const cleanColor = (v, def) => /^#[0-9a-fA-F]{6}$/.test(v) ? v : def;
const cleanDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v)) ? v : '';
const cleanPhone = v => { v = str(v, 20).trim(); return /^[+0-9 ()-]{5,20}$/.test(v) ? v : ''; };
const cleanEmail = v => { v = str(v, 120).trim(); return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v) ? v : ''; };

function cleanSite(x) {
  x = x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  const t = x.theme || {}, c = x.content || {}, f = x.footer || {}, an = c.announce || {}, so = f.social || {};
  return {
    logo: cleanImg(x.logo, LOGO_MAX, 'logo'),
    theme: {
      festival: FESTIVALS.includes(t.festival) ? t.festival : 'none',
      from: cleanDay(t.from), to: cleanDay(t.to), effects: t.effects !== false,
      greeting: str(t.greeting, 160), brand: cleanColor(t.brand, '#0F4C4A'), accent: cleanColor(t.accent, '#E39A1B')
    },
    content: {
      headline: str(c.headline, 160), intro: str(c.intro, 500), welcome: str(c.welcome, 200),
      steps: (Array.isArray(c.steps) ? c.steps : []).slice(0, 3).map(s => ({ t: str(s && s.t, 60), d: str(s && s.d, 160) })),
      announce: { on: !!an.on, text: str(an.text, 200), link: cleanUrl(an.link) }
    },
    footer: {
      place: (p => ({ name: str(p.name, 80).trim(), line1: str(p.line1, 140).trim(), area: str(p.area, 80).trim(), city: str(p.city, 60).trim(), state: str(p.state, 60).trim(), pin: /^\d{6}$/.test(str(p.pin, 6).trim()) ? str(p.pin, 6).trim() : '' }))(f.place && typeof f.place === 'object' ? f.place : {}),
      mapUrl: cleanWebUrl(f.mapUrl),
      about: str(f.about, 400), phone: cleanPhone(f.phone), email: cleanEmail(f.email), hours: str(f.hours, 120),
      links: (Array.isArray(f.links) ? f.links : []).slice(0, 6).map(l => ({ label: str(l && l.label, 40).trim(), url: cleanUrl(l && l.url) })).filter(l => l.label && l.url),
      social: { facebook: cleanWebUrl(so.facebook), instagram: cleanWebUrl(so.instagram), youtube: cleanWebUrl(so.youtube), whatsapp: cleanWebUrl(so.whatsapp), x: cleanWebUrl(so.x) },
      image: cleanImg(f.image, PHOTO_MAX, 'footer image'), caption: str(f.caption, 120), showImage: f.showImage !== false,
      copyright: str(f.copyright, 160)
    }
  };
}

function cleanSettings(ex, d) {
  const n = { ...(ex || {}) };
  for (const k of SETTINGS_FIELDS) if (k in d) n[k] = d[k];
  n.name = str(n.name, 80) || 'Queenstown Society';
  for (const k of ['tagline', 'address', 'upi', 'upiName', 'bank']) if (k in n) n[k] = str(n[k], 300);
  if ('bankDetails' in n) {
    const b = n.bankDetails && typeof n.bankDetails === 'object' ? n.bankDetails : {};
    const number = str(b.number, 24).replace(/\s+/g, ''), ifsc = str(b.ifsc, 11).trim().toUpperCase();
    n.bankDetails = {
      holder: str(b.holder, 100).trim(), number: /^\d{9,18}$/.test(number) ? number : '',
      ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) ? ifsc : '', bank: str(b.bank, 80).trim(), branch: str(b.branch, 80).trim(),
      type: b.type === 'Savings' ? 'Savings' : 'Current'
    };
  }
  if ('payMethods' in n) {
    const p = n.payMethods && typeof n.payMethods === 'object' ? n.payMethods : {};
    n.payMethods = { online: false, upi: p.upi !== false, bank: p.bank !== false };
    if (!n.payMethods.upi && !n.payMethods.bank) n.payMethods = { online: false, upi: true, bank: true };
  }
  if (Array.isArray(n.charges)) n.charges = n.charges.slice(0, 20).map(x => ({ label: str(x && x.label, 80), amt: num(x && x.amt, 0, 1e7, 0) }));
  n.dueDay = Math.round(num(n.dueDay, 1, 28, 15));
  n.latePct = num(n.latePct, 0, 100, 0);
  n.adRates = { banner: num(n.adRates && n.adRates.banner, 0, 1e6, 0), classified: num(n.adRates && n.adRates.classified, 0, 1e6, 0) };
  if ('site' in n) n.site = cleanSite(n.site);
  n.id = 'settings';
  delete n.adminUser; delete n.adminHash;
  return n;
}

async function applyChanges(actor, store, changes, now = Date.now()) {
  const admin = actor.role === 'admin';
  if (!canAct(actor)) throw new HttpError(403, 'Your registration is not approved yet.');
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new HttpError(400, 'Bad request.');

  let total = 0;
  for (const k of Object.keys(changes)) {
    const ch = changes[k] || {};
    total += (Array.isArray(ch.upsert) ? ch.upsert.length : 0) + (Array.isArray(ch.remove) ? ch.remove.length : 0);
  }
  if (total > 600) throw new HttpError(413, 'Too many changes at once.');

  const settings = (await store.get('settings', 'settings')) || {};
  const ctx = { actor, admin, guard: isGuard(actor), aid: admin ? 'admin' : actor.id, fk: admin || isGuard(actor) ? '' : flatKey(actor), store, now, settings, name: actor.name || '' };
  const rejected = [];
  let applied = 0, touchedNotifs = false;

  for (const coll of Object.keys(changes)) {
    const ch = changes[coll] || {};
    const ups = Array.isArray(ch.upsert) ? ch.upsert : [], rems = Array.isArray(ch.remove) ? ch.remove : [];

    if (coll === 'settings') {
      if (!admin) continue;
      for (const raw of ups) {
        try { await store.put('settings', cleanSettings(settings, sanitize(raw))); applied++; }
        catch (e) { rejected.push({ coll, id: 'settings', err: e.message }); }
      }
      continue;
    }

    const R = RULES[coll];
    if (!R) { rejected.push({ coll, id: '', err: 'Unknown collection.' }); continue; }
    if (coll === 'notifs') touchedNotifs = true;

    for (const raw of ups) {
      let d;
      try { d = sanitize(raw); } catch (e) { rejected.push({ coll, id: String(raw && raw.id), err: e.message }); continue; }
      if (!isId(d.id)) { rejected.push({ coll, id: String(d.id), err: 'Bad id.' }); continue; }
      delete d.pass; delete d.passHash; delete d.pwdAt;
      const ex = await store.get(coll, d.id);
      const r = await R.upsert(ctx, ex, d);
      if (r.err) { rejected.push({ coll, id: d.id, err: r.err }); continue; }
      if (r.doc) { r.doc.id = d.id; await store.put(coll, r.doc); applied++; }
    }

    for (const id of rems) {
      if (!isId(id)) continue;
      const ex = await store.get(coll, id);
      if (!ex) continue;
      const r = await R.remove(ctx, ex);
      if (r.skip) continue;
      if (r.err) { rejected.push({ coll, id, err: r.err }); continue; }
      await store.del(coll, id); applied++;
    }
  }

  if (touchedNotifs) {
    const all = await store.all('notifs');
    if (all.length > 600) for (const n of all.slice(0, all.length - 600)) await store.del('notifs', n.id);
  }
  return { applied, rejected };
}

module.exports = { isGuard, canAct, cleanSite, COLLS, UNSHIFT, HttpError, sanitize, viewFor, publicView, applyChanges, flatKey, userSafe, str, num, isId };
