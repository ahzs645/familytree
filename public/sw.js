const CACHE_NAME = 'cloudtreeweb-familytree-v2';

// Family tree datasets (the ?url= import flow) must always come from the
// network: cache-first would serve a stale tree one reload behind after the
// published package is updated.
const DATASET_RE = /\.(zip|mftpkg|ged|gedz|sqlite)$/i;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './cloudtreeweb_webapp_icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (DATASET_RE.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', network.clone()).catch(() => {});
        return network;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const fetched = fetch(request).then((response) => {
      if (response?.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    }).catch(() => cached);
    return cached || fetched;
  })());
});
