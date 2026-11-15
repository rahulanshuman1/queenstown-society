'use strict';
/* Towers and flat numbers.
   The admin edits them in Site studio (settings.site.towers). Until they have, the society has the original
   four towers A to D with flats 101 to 104 up to 1001 to 1004, so nothing changes for existing installs. */

const MAX_TOWERS = 30, MAX_FLATS = 400;
const CODE_RE = /^[A-Z0-9]{1,4}$/;
const FLAT_RE = /^[A-Z0-9][A-Z0-9-]{0,7}$/;

const cmp = (a, b) => a.localeCompare(b, undefined, { numeric: true });

/* floors 1..n with `per` flats each: 101, 102, ... 1004 */
function genFlats(floors = 10, per = 4) {
  const out = [];
  for (let f = 1; f <= floors; f++) for (let u = 1; u <= per; u++) out.push(String(f * 100 + u));
  return out;
}

const defaultTowers = () => ['A', 'B', 'C', 'D'].map(code => ({ code, name: 'Tower ' + code, flats: genFlats(10, 4) }));

/* Cleans whatever the browser sent. Returns [] when nothing usable was sent. */
function cleanTowers(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set(), out = [];
  for (const t of v.slice(0, MAX_TOWERS)) {
    if (!t || typeof t !== 'object') continue;
    const code = String(t.code == null ? '' : t.code).trim().toUpperCase();
    if (!CODE_RE.test(code) || seen.has(code)) continue;
    seen.add(code);
    const fs = new Set();
    for (const x of (Array.isArray(t.flats) ? t.flats : []).slice(0, MAX_FLATS * 2)) {
      const f = String(x == null ? '' : x).trim().toUpperCase();
      if (FLAT_RE.test(f)) fs.add(f);
      if (fs.size >= MAX_FLATS) break;
    }
    out.push({ code, name: String(t.name == null ? '' : t.name).trim().slice(0, 40), flats: [...fs].sort(cmp) });
  }
  return out;
}

/* The towers in force for a settings document. */
function towersOf(settings) {
  const t = settings && settings.site && cleanTowers(settings.site.towers);
  return t && t.length ? t : defaultTowers();
}

const hasFlat = (settings, tower, flat) => towersOf(settings).some(t => t.code === tower && t.flats.includes(flat));

module.exports = { genFlats, defaultTowers, cleanTowers, towersOf, hasFlat, CODE_RE, FLAT_RE };
