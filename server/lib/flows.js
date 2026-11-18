'use strict';
/* The no-code engine, shared by the browser and the API (one file, two runtimes).

   A blueprint is plain data: modules switched on or off, forms made of fields, and automations
   ("when this happens, if that is true, do these things"). This file knows how to
     - clean a blueprint so nothing unexpected is stored (clean)
     - answer which automations fire for an event (run), returning the effects as data
   It never touches a database. Whoever calls run() applies the effects, so the same rules work in
   the offline demo (browser) and the real server, where the server is the only place that applies them. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QSFlows = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  const MODULES = ['notices', 'events', 'forecast', 'helpdesk', 'amenities', 'visitors', 'marketplace', 'polls', 'gallery', 'accounts', 'documents', 'directory'];
  const FIELD_TYPES = ['text', 'longtext', 'number', 'date', 'select', 'checkbox', 'phone'];
  const TRIGGERS = ['request.created', 'complaint.created'];
  const OPS = ['is', 'isnot', 'contains', 'gt', 'lt', 'empty'];
  const ACTIONS = ['notify_admin', 'notify_resident', 'set_status', 'assign', 'post_notice'];
  const REQ_STATUS = ['pending', 'approved', 'rejected', 'done'];
  const TKT_STATUS = ['open', 'in-progress', 'resolved'];
  const ICONS = ['layout', 'key', 'building', 'book', 'tag', 'users', 'gear', 'wallet', 'flag', 'visitor', 'calendar', 'shield'];

  const str = (v, max) => String(v == null ? '' : v).slice(0, max);
  const isId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
  const arr = v => (Array.isArray(v) ? v : []);
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

  /* ---------- cleaning ---------- */
  function cleanField(f, i, seen) {
    f = obj(f);
    let id = isId(f.id) ? f.id : 'f' + (i + 1);
    while (seen.has(id)) id += 'x';
    seen.add(id);
    const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
    const out = { id, label: str(f.label, 80).trim() || 'Question ' + (i + 1), type, req: !!f.req };
    if (type === 'select') {
      out.options = arr(f.options).map(o => str(o, 60).trim()).filter(Boolean).slice(0, 20);
      if (!out.options.length) out.options = ['Option 1', 'Option 2'];
    }
    return out;
  }
  function cleanForm(f, i, seenForms) {
    f = obj(f);
    let id = isId(f.id) ? f.id : 'form' + (i + 1);
    while (seenForms.has(id)) id += 'x';
    seenForms.add(id);
    const seen = new Set();
    return {
      id, name: str(f.name, 60).trim() || 'Untitled form', desc: str(f.desc, 200).trim(),
      icon: ICONS.includes(f.icon) ? f.icon : 'layout', on: f.on !== false,
      audience: ['all', 'Owner', 'Tenant'].includes(f.audience) ? f.audience : 'all',
      fields: arr(f.fields).slice(0, 15).map((x, k) => cleanField(x, k, seen))
    };
  }
  function cleanFlow(w, i, seenFlows) {
    w = obj(w);
    let id = isId(w.id) ? w.id : 'flow' + (i + 1);
    while (seenFlows.has(id)) id += 'x';
    seenFlows.add(id);
    const action = a => {
      a = obj(a);
      if (!ACTIONS.includes(a.type)) return null;
      const o = { type: a.type };
      if (a.type === 'notify_admin' || a.type === 'notify_resident') o.text = str(a.text, 200);
      if (a.type === 'set_status') o.value = str(a.value, 20);
      if (a.type === 'assign') o.value = str(a.value, 60);
      if (a.type === 'post_notice') { o.title = str(a.title, 120); o.text = str(a.text, 600); }
      return o;
    };
    return {
      id, name: str(w.name, 80).trim() || 'Automation ' + (i + 1), on: w.on !== false,
      trigger: TRIGGERS.includes(w.trigger) ? w.trigger : 'request.created',
      formId: isId(w.formId) ? w.formId : '',
      conds: arr(w.conds).slice(0, 4).map(c => { c = obj(c); return { field: str(c.field, 60), op: OPS.includes(c.op) ? c.op : 'is', value: str(c.value, 80) }; }).filter(c => c.field),
      actions: arr(w.actions).slice(0, 4).map(action).filter(Boolean)
    };
  }
  /* A blueprint is { modules, forms, flows, template }. Anything else is dropped. */
  function clean(b) {
    b = obj(b);
    const modules = {};
    const m = obj(b.modules);
    for (const k of MODULES) if (m[k] === false) modules[k] = false;
    const sf = new Set(), sw = new Set();
    return {
      template: str(b.template, 30).replace(/[^a-z0-9-]/gi, ''),
      modules,
      forms: arr(b.forms).slice(0, 12).map((f, i) => cleanForm(f, i, sf)),
      flows: arr(b.flows).slice(0, 20).map((w, i) => cleanFlow(w, i, sw))
    };
  }

  /* ---------- reading an answer back as text ---------- */
  const fmtAnswer = (f, v) => (f.type === 'checkbox' ? (v ? 'Yes' : 'No') : v == null ? '' : String(v));
  /* Check what a resident sent against the form. Returns { answers } or { err }. Unknown ids are dropped. */
  function checkAnswers(form, raw) {
    raw = obj(raw);
    const answers = {};
    for (const f of form.fields) {
      let v = raw[f.id];
      if (f.type === 'checkbox') { answers[f.id] = v === true || v === 'on' || v === 'true'; if (f.req && !answers[f.id]) return { err: 'Please tick: ' + f.label }; continue; }
      v = str(v, f.type === 'longtext' ? 1500 : 200).trim();
      if (!v) { if (f.req) return { err: f.label + ' is required.' }; answers[f.id] = ''; continue; }
      if (f.type === 'number') { if (!Number.isFinite(Number(v))) return { err: f.label + ' must be a number.' }; v = String(Number(v)); }
      if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { err: f.label + ' must be a date.' };
      if (f.type === 'phone' && !/^[+0-9 ()-]{5,20}$/.test(v)) return { err: f.label + ' must be a phone number.' };
      if (f.type === 'select' && !f.options.includes(v)) return { err: 'Choose one of the options for ' + f.label + '.' };
      answers[f.id] = v;
    }
    return { answers };
  }

  /* ---------- running automations ---------- */
  /* Path lookup on the event record: 'flat', 'priority', 'form', or 'a.<fieldId>' for a form answer. */
  function pick(rec, path) {
    if (path.startsWith('a.')) { const v = obj(rec.answers)[path.slice(2)]; return v == null ? '' : v; }
    const v = rec[path];
    return v == null ? '' : v;
  }
  function test(c, rec) {
    const got = String(pick(rec, c.field)).trim().toLowerCase(), want = String(c.value).trim().toLowerCase();
    switch (c.op) {
      case 'is': return got === want;
      case 'isnot': return got !== want;
      case 'contains': return want !== '' && got.includes(want);
      case 'gt': return got !== '' && Number(got) > Number(want);
      case 'lt': return got !== '' && Number(got) < Number(want);
      case 'empty': return got === '';
      default: return false;
    }
  }
  /* {{name}} {{flat}} {{form}} {{title}} {{a.<fieldId>}} in a message become real values */
  function fill(t, rec) {
    return String(t || '').replace(/\{\{\s*([a-zA-Z0-9_.-]{1,50})\s*\}\}/g, (_, k) => String(pick(rec, k)).slice(0, 200)).slice(0, 600);
  }
  /* trigger: 'request.created' | 'complaint.created'. rec: the new record, flattened for matching.
     Returns the effects to apply, in order. Pure function: same input, same output. */
  function run(blueprint, trigger, rec) {
    const bp = clean(blueprint), effects = [];
    for (const w of bp.flows) {
      if (!w.on || w.trigger !== trigger) continue;
      if (w.formId && w.formId !== rec.formId) continue;
      if (!w.conds.every(c => test(c, rec))) continue;
      for (const a of w.actions) {
        const e = { type: a.type, flow: w.id };
        if (a.type === 'notify_admin' || a.type === 'notify_resident') { e.text = fill(a.text, rec); if (!e.text) continue; }
        else if (a.type === 'set_status') {
          const ok = trigger === 'request.created' ? REQ_STATUS : TKT_STATUS;
          if (!ok.includes(a.value)) continue;
          e.value = a.value;
        } else if (a.type === 'assign') { e.value = fill(a.value, rec).slice(0, 60); if (!e.value) continue; }
        else if (a.type === 'post_notice') { e.title = fill(a.title, rec).slice(0, 120); e.text = fill(a.text, rec); if (!e.title) continue; }
        effects.push(e);
      }
    }
    return effects;
  }

  return { MODULES, FIELD_TYPES, TRIGGERS, OPS, ACTIONS, REQ_STATUS, TKT_STATUS, ICONS, clean, checkAnswers, run, fill, pick, fmtAnswer };
});
