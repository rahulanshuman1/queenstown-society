'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../lib/store');
const { bootstrap } = require('../lib/bootstrap');
const { load } = require('../lib/config');

// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let server, base, store, admin, resident;
const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const saveSite = (token, site, extra = {}) => call('POST', '/api/sync', { changes: { settings: { upsert: [{ id: 'settings', site, ...extra }] } } }, token);
const publicSite = async () => (await call('GET', '/api/public')).body.db.settings.site;

test.before(async () => {
  const config = load({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'adminpass1', JWT_SECRET: 'x'.repeat(40) });
  store = new MemoryStore();
  await bootstrap(store, config, { log() {} });
  server = createApp({ store, config, razorpay: null });
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
  admin = (await call('POST', '/api/auth/login', { id: 'admin', password: 'adminpass1' })).body.token;
  const reg = await call('POST', '/api/auth/register', { name: 'Priya Nair', mobile: '9876500001', tower: 'A', flat: '101', type: 'Owner', password: 'secret123', members: 2 });
  resident = reg.body.token;
  await call('POST', '/api/sync', { changes: { users: { upsert: [{ id: reg.body.session.id, status: 'approved' }] } } }, admin);
});
test.after(() => server.close());

const full = () => ({
  logo: PNG,
  theme: { festival: 'diwali', from: '2026-11-01', to: '2026-11-15', effects: true, greeting: 'Happy Diwali!', brand: '#112233', accent: '#ffaa00' },
  content: { headline: 'Welcome home', intro: 'Intro text', welcome: 'Hello neighbours', steps: [{ t: 'One', d: 'First' }, { t: 'Two', d: 'Second' }, { t: 'Three', d: 'Third' }], announce: { on: true, text: 'AGM on Sunday', link: '#events' } },
  footer: { about: 'About us', phone: '+91 98765 43210', email: 'office@queenstown.in', hours: 'Mon to Sat, 9 to 6', links: [{ label: 'Bye-laws', url: 'https://example.com/bylaws.pdf' }], social: { facebook: 'https://facebook.com/queenstown', instagram: '', youtube: '', whatsapp: '', x: '' }, image: PNG, caption: 'Clubhouse', showImage: true, copyright: '' }
});

test('admin saves the site look and content; visitors see it before signing in', async () => {
  const r = await saveSite(admin, full());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.rejected || [], []);
  const s = await publicSite();
  assert.equal(s.logo, PNG);
  assert.equal(s.theme.festival, 'diwali');
  assert.equal(s.theme.greeting, 'Happy Diwali!');
  assert.equal(s.content.headline, 'Welcome home');
  assert.equal(s.content.announce.text, 'AGM on Sunday');
  assert.equal(s.footer.image, PNG);
  assert.equal(s.footer.links[0].url, 'https://example.com/bylaws.pdf');
  const ses = (await call('GET', '/api/state', null, resident)).body.db.settings;
  assert.equal(ses.site.theme.festival, 'diwali', 'residents get it too');
  assert.equal(ses.payOnline, false);
});

test('a resident cannot change the site', async () => {
  await saveSite(resident, { ...full(), theme: { festival: 'holi' } });
  assert.equal((await publicSite()).theme.festival, 'diwali');
});

test('unsafe links, unknown themes and bad colours are cleaned', async () => {
  const f = full();
  f.theme = { festival: 'evil<script>', brand: 'red; background:url(x)', accent: '#GGGGGG', from: 'tomorrow', to: '' };
  f.content.announce.link = 'javascript:alert(1)';
  f.footer.links = [{ label: 'Bad', url: 'javascript:alert(1)' }, { label: 'Data', url: 'data:text/html,hi' }, { label: 'Good', url: 'https://ok.example' }, { label: 'Inside', url: '#events' }, { label: '', url: 'https://nolabel.example' }];
  f.footer.social = { facebook: 'javascript:alert(1)', instagram: '#home', youtube: 'https://youtube.com/@q', whatsapp: '', x: '' };
  f.footer.email = 'not an email';
  f.footer.phone = '<b>call</b>';
  const r = await saveSite(admin, f);
  assert.deepEqual(r.body.rejected || [], []);
  const s = await publicSite();
  assert.equal(s.theme.festival, 'none');
  assert.equal(s.theme.brand, '#0F4C4A');
  assert.equal(s.theme.accent, '#E39A1B');
  assert.equal(s.theme.from, '');
  assert.equal(s.content.announce.link, '');
  assert.deepEqual(s.footer.links.map(l => l.label), ['Good', 'Inside']);
  assert.equal(s.footer.social.facebook, '');
  assert.equal(s.footer.social.instagram, '', 'social links must be web addresses');
  assert.equal(s.footer.social.youtube, 'https://youtube.com/@q');
  assert.equal(s.footer.email, '');
  assert.equal(s.footer.phone, '');
});

test('images must be small PNG, JPEG or WebP; a bad image is refused and the old site stays', async () => {
  await saveSite(admin, full());
  for (const [what, patch] of [
    ['logo', { logo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }],
    ['logo', { logo: 'https://evil.example/logo.png' }],
    ['logo', { logo: 'data:image/png;base64,' + 'A'.repeat(170000) }],
    ['footer image', { footer: { ...full().footer, image: 'data:image/png;base64,' + 'A'.repeat(520000) } }]
  ]) {
    const r = await saveSite(admin, { ...full(), ...patch, content: { headline: 'SHOULD NOT SAVE' } });
    assert.ok(r.body.rejected && r.body.rejected.length, 'rejected: ' + what);
    assert.match(r.body.rejected[0].err, new RegExp(what));
  }
  const s = await publicSite();
  assert.equal(s.content.headline, 'Welcome home');
  assert.equal(s.logo, PNG);
});

test('site settings do not disturb the other settings', async () => {
  const before = (await call('GET', '/api/state', null, admin)).body.db.settings;
  await saveSite(admin, full());
  const after = (await call('GET', '/api/state', null, admin)).body.db.settings;
  for (const k of ['name', 'tagline', 'dueDay', 'latePct', 'charges', 'upi']) assert.deepEqual(after[k], before[k], k);
});
