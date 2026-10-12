/* Janets Karenderya — Service Worker (offline-first) */
const VERSION = 'jk-v1.2.0';
const STATIC_CACHE = 'jk-static-' + VERSION;

// Resolve base path so the SW works when hosted from a GitHub Pages subdirectory.
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const BASE = SCOPE_PATH.endsWith('/') ? SCOPE_PATH : SCOPE_PATH + '/';

const CORE_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'css/styles.css',
  BASE + 'js/db.js',
  BASE + 'js/utils.js',
  BASE + 'js/state.js',
  BASE + 'js/charts.js',
  BASE + 'js/dashboard.js',
  BASE + 'js/cashier.js',
  BASE + 'js/inventory.js',
  BASE + 'js/forecasts.js',
  BASE + 'js/expenses.js',
  BASE + 'js/transactions.js',
  BASE + 'js/reports.js',
  BASE + 'js/settings.js',
  BASE + 'js/app.js',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Stale-while-revalidate: serve cached fast, update cache in background
  event.respondWith(
    caches.open(STATIC_CACHE).then(cache =>
      cache.match(req).then(cached => {
        const fetchPromise = fetch(req).then(resp => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            cache.put(req, resp.clone());
          }
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});
