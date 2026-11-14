// Offline-first shell cache. Bump VERSION whenever index.html changes.
// Only this site's own files are cached. API calls and other sites are never cached,
// because they carry private society data.
const VERSION = 'qs-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './assets/queenstown-logo.png', './assets/queenstown-castle.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.endsWith('/config.js')) return;
  e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {}); return res; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
