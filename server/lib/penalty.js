'use strict';
/* Late payment penalty on maintenance bills.
   The admin sets it in Society setup (settings.penalty). Until they do, the old "late fee %" setting keeps working
   as a one-time percentage with no grace period, so existing bills are priced exactly as before.

   Rule: a bill is on time until the end of its due day plus the grace days. After that the penalty applies:
     once    one penalty
     monthly one penalty, plus another for every further 30 days
     daily   one penalty for the first late day, plus another for every further day
   The penalty is a percentage of the bill amount or a fixed rupee amount, optionally capped at a maximum in rupees. */

const DAY = 86400e3;
const REPEATS = ['once', 'monthly', 'daily'];
const TYPES = ['percent', 'fixed'];
const num = (v, min, max, def) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };

/* Cleans what the browser sent. */
function cleanPenalty(p) {
  p = p && typeof p === 'object' ? p : {};
  const type = TYPES.includes(p.type) ? p.type : 'percent';
  return {
    enabled: !!p.enabled,
    graceDays: Math.round(num(p.graceDays, 0, 60, 0)),
    type,
    value: Math.round(num(p.value, 0, type === 'percent' ? 100 : 1e6, 0) * 100) / 100,
    repeat: REPEATS.includes(p.repeat) ? p.repeat : 'once',
    cap: Math.round(num(p.cap, 0, 1e7, 0))
  };
}

/* The penalty rules in force for a settings document. */
function penaltyCfg(settings) {
  const s = settings || {};
  if (s.penalty && typeof s.penalty === 'object') return cleanPenalty(s.penalty);
  const pct = num(s.latePct, 0, 100, 0);
  return { enabled: pct > 0, graceDays: 0, type: 'percent', value: pct, repeat: 'once', cap: 0 };
}

/* How many times the penalty has been charged by `now` (0 when still on time). */
function penaltyUnits(dueDate, cfg, now) {
  const start = +new Date(dueDate) + cfg.graceDays * DAY;
  if (!Number.isFinite(start) || now <= start) return 0;
  const late = now - start;
  return cfg.repeat === 'daily' ? 1 + Math.floor(late / DAY) : cfg.repeat === 'monthly' ? 1 + Math.floor(late / (30 * DAY)) : 1;
}

/* Penalty in rupees for one bill. */
function penaltyOf(amount, dueDate, settings, now = Date.now()) {
  const cfg = penaltyCfg(settings);
  if (!cfg.enabled || !(cfg.value > 0)) return 0;
  const units = penaltyUnits(dueDate, cfg, now);
  if (!units) return 0;
  const each = cfg.type === 'fixed' ? cfg.value : (Number(amount) || 0) * cfg.value / 100;
  const total = Math.round(units * each);
  return cfg.cap > 0 ? Math.min(total, cfg.cap) : total;
}

module.exports = { cleanPenalty, penaltyCfg, penaltyUnits, penaltyOf };
