'use strict';
/* File attachments for notices and events.
   Metadata lives in the `files` collection and the bytes in `fdata`, so the normal data sync
   (which sends every notice and event to every resident) never carries file contents.
   Only the admin can upload. Residents get a short-lived signed link for a file they can see. */
const crypto = require('crypto');

const FILE_MAX = 5 * 1024 * 1024;
const GRACE_MS = 60 * 60e3; // an uploaded file that no notice or event uses is removed after this long

const startsWith = (b, bytes) => b.length >= bytes.length && bytes.every((v, i) => b[i] === v);
const TYPES = {
  pdf: { mime: 'application/pdf', inline: true, magic: b => b.slice(0, 5).toString('latin1') === '%PDF-' },
  png: { mime: 'image/png', inline: true, magic: b => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) },
  jpg: { mime: 'image/jpeg', inline: true, magic: b => startsWith(b, [0xff, 0xd8, 0xff]) },
  jpeg: { mime: 'image/jpeg', inline: true, magic: b => startsWith(b, [0xff, 0xd8, 0xff]) },
  webp: { mime: 'image/webp', inline: true, magic: b => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', inline: false, magic: b => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', inline: false, magic: b => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  doc: { mime: 'application/msword', inline: false, magic: b => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]) },
  xls: { mime: 'application/vnd.ms-excel', inline: false, magic: b => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]) }
};
const MIMES = new Set(Object.values(TYPES).map(t => t.mime));
const INLINE = new Set(Object.values(TYPES).filter(t => t.inline).map(t => t.mime));

const isId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const extOf = n => { const m = /\.([A-Za-z0-9]{2,5})$/.exec(String(n || '')); return m ? m[1].toLowerCase() : ''; };
const cleanName = n => String(n == null ? '' : n).split(/[\\/]/).pop().replace(/[\u0000-\u001f"<>|:*?]/g, '').trim().slice(0, 120) || 'file';
const err = (status, message) => Object.assign(new Error(message), { status, client: true });

/* Decode and check an upload. The type comes from the file name and must match the real bytes. */
function check({ name, data }) {
  name = cleanName(name);
  const t = TYPES[extOf(name)];
  if (!t) throw err(400, 'Upload a PDF, image (PNG, JPEG, WebP), Word or Excel file.');
  if (typeof data !== 'string' || !data) throw err(400, 'The file is empty.');
  if (data.length > Math.ceil(FILE_MAX * 4 / 3) + 8) throw err(413, 'The file is too large. The limit is 5 MB.');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw err(400, 'The file could not be read.');
  const buf = Buffer.from(data, 'base64');
  if (!buf.length) throw err(400, 'The file is empty.');
  if (buf.length > FILE_MAX) throw err(413, 'The file is too large. The limit is 5 MB.');
  if (!t.magic(buf)) throw err(400, 'The contents do not match the file type. Pick the original file.');
  return { name, mime: t.mime, size: buf.length, data };
}

async function put(store, actorId, body, now = Date.now()) {
  const f = check(body || {});
  const id = 'f' + crypto.randomBytes(12).toString('hex');
  await store.put('files', { id, name: f.name, mime: f.mime, size: f.size, at: now, by: actorId });
  await store.put('fdata', { id, data: f.data });
  return { id, name: f.name, mime: f.mime, size: f.size };
}

async function get(store, id) {
  if (!isId(id)) return null;
  const meta = await store.get('files', id), d = meta && await store.get('fdata', id);
  return meta && d ? { ...meta, inline: INLINE.has(meta.mime), buf: Buffer.from(d.data, 'base64') } : null;
}

/* What a notice or event keeps: a small description of the file, never its bytes. */
function cleanAtt(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  if (!isId(a.id) || !MIMES.has(a.mime)) return null;
  const size = Number(a.size);
  return { id: a.id, name: cleanName(a.name), mime: a.mime, size: Number.isFinite(size) ? Math.max(0, Math.min(FILE_MAX, Math.round(size))) : 0 };
}

/* Delete files that no notice or event points to any more (and are older than the grace period). */
async function sweep(store, now = Date.now()) {
  const used = new Set();
  for (const c of ['notices', 'events']) for (const d of await store.all(c)) if (d && d.attachment && d.attachment.id) used.add(d.attachment.id);
  let n = 0;
  for (const f of await store.all('files')) {
    if (used.has(f.id) || now - (f.at || 0) < GRACE_MS) continue;
    await store.del('files', f.id); await store.del('fdata', f.id); n++;
  }
  return n;
}

const dispositionName = n => `filename="${n.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(n).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`;

module.exports = { FILE_MAX, TYPES, MIMES, INLINE, check, put, get, cleanAtt, cleanName, sweep, dispositionName, GRACE_MS };
