const CACHE = 'tide-erp-v191';
const FILES = ['./', './index.html', './app.css', './app.js', './db.js', './tax.js', './trash.js', './manifest.webmanifest', './tide.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Never intercept external requests (Firebase SDK CDN, Firestore WebSocket/REST traffic)
  if (url.origin !== location.origin) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
































