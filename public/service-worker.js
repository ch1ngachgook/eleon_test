// Basic service worker
const CACHE_NAME = 'hotelkey-cache-v1';
const urlsToCache = [
  '/',
  '/login',
  // Add other important routes if they can be fully static or app-shell based
  '/manifest.json',
  '/favicon.ico', // Assuming you might add one
  // Add paths to your main JS/CSS bundles if you know them,
  // otherwise rely on caching them as they are fetched.
  // Next.js specific assets are often dynamically named, so a network-first or stale-while-revalidate strategy is better.
  '/offline.html' // A fallback offline page
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Failed to cache app shell:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // console.log('[Service Worker] Fetch:', event.request.url);
  // Use a cache-first strategy for assets that were explicitly cached during install
  if (urlsToCache.includes(new URL(event.request.url).pathname)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
    return;
  }

  // For other requests (e.g., API calls, Next.js chunks), use a network-first strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If successful, clone the response and cache it for future offline use
        if (!response || response.status !== 200 || response.type !== 'basic') {
          if (response && response.type === 'opaque') { // opaque responses (e.g. CDN for images) can be cached but not inspected
             const responseToCache = response.clone();
             caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, responseToCache);
             });
          }
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache and network failed, serve an offline fallback page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          return undefined; // For non-navigation requests like API calls, just fail
        });
      })
  );
});
