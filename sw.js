const CACHE = 'tide-erp-v212';
const FILES = ['./', './index.html', './app.css?v=149', './firebase.js?v=8', './db.js?v=119', './tax.js?v=94', './trash.js?v=97', './table-tools.js?v=3', './i18n.js?v=2', './app.js?v=202', './manifest.webmanifest', './tide.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Never intercept external requests (Firebase SDK CDN, Firestore WebSocket/REST traffic) or serverless APIs
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Versioned static assets (?v=...) are immutable per release — serve instantaneously from cache!
  if (url.searchParams.has('v') || /\.(svg|png|jpg|jpeg|webp|woff2?|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML navigation: network-first with a fast 2s timeout fallback to cached shell so refreshes never stall
  event.respondWith(
    new Promise((resolve) => {
      let settled = false;
      const fallbackTimer = setTimeout(() => {
        caches.match(event.request).then(cached => {
          if (!settled && cached) {
            settled = true;
            resolve(cached);
          }
        });
      }, 2000);

      fetch(event.request).then(response => {
        clearTimeout(fallbackTimer);
        if (response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        if (!settled) {
          settled = true;
          resolve(response);
        }
      }).catch(() => {
        clearTimeout(fallbackTimer);
        caches.match(event.request).then(cached => {
          if (!settled) {
            settled = true;
            resolve(cached || caches.match('./index.html'));
          }
        });
      });
    })
  );
});
































