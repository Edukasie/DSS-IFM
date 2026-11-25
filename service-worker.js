// DSS Service Worker — v35
// Network-first for app code; cache-first for static assets.
const CACHE_NAME = 'dss-app-v35';
const APP_SHELL = new URL('./index.html', self.registration.scope).toString();
const PRECACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/css/kpi.css',
  './assets/css/dashboard.css',
  './assets/js/config.js',
  './assets/js/app.js',
  './assets/js/dashboard-fx.js',
  './assets/images/edukasie-dss-logo.jpg',
  './assets/icons/dss-icon.png',
  './assets/icons/dss-icon@2x.png',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE_FILES.map(async path => {
      const url = new URL(path, self.registration.scope).toString();
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response);
        else console.warn('[DSS SW] Precache skipped:', path, response.status);
      } catch (error) {
        console.warn('[DSS SW] Precache failed:', path, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('dss-app-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Store a copy without ever letting a cache error break the network response.
// Only complete (200) responses are cacheable; 206 partial responses throw in cache.put().
async function remember(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  } catch (error) {
    console.warn('[DSS SW] Cache put failed:', request.url, error);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;

  const isAppFile = request.mode === 'navigate' || /\.(html|js|css|json)$/i.test(url.pathname);

  event.respondWith((async () => {
    if (isAppFile) {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        event.waitUntil(remember(request, response.clone()));
        return response;
      } catch (error) {
        const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match(APP_SHELL);
          if (shell) return shell;
        }
        return new Response('DSS resource temporarily unavailable.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    }

    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      event.waitUntil(remember(request, response.clone()));
      return response;
    } catch (error) {
      return new Response('', { status: 504, statusText: 'Gateway Timeout' });
    }
  })());
});
