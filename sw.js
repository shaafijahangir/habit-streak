const CACHE_NAME = 'streaks-v7';
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Install — only pre-cache truly static assets (icons, manifest)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - JS/CSS/HTML: network-first, fall back to cache (so updates always land)
// - Icons/manifest: cache-first (truly static)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isStatic = /\.(png|ico|webp|svg)$/.test(url.pathname) || url.pathname.endsWith('manifest.json');

  if (isStatic) {
    // Cache-first for static assets
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  } else {
    // Network-first for HTML/JS/CSS — always fresh, cache as fallback
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});
