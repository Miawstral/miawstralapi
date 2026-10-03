/* Miawstral service worker: instant start and offline fallback. */
const VERSION = 'miawstral-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/favicon.svg'];
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;

self.addEventListener('install', event => {
    event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(keys => Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

const staleWhileRevalidate = async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const network = fetch(request)
        .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);
    return cached || network;
};

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Pages: network first, the cached shell when offline.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (url.pathname === '/' && response.ok) {
                        const copy = response.clone();
                        caches.open(STATIC_CACHE).then(cache => cache.put('/', copy));
                    }
                    return response;
                })
                .catch(() => caches.match(url.pathname.startsWith('/docs') ? request : '/')),
        );
        return;
    }
    // Hashed build files never change.
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(caches.match(request).then(cached => cached || staleWhileRevalidate(request, STATIC_CACHE)));
        return;
    }
    // Stops and lines change with the timetable only.
    if (url.pathname === '/api/stops' || url.pathname === '/api/lines' || url.pathname === '/api/data/status') {
        event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    }
    // Everything else (real time, itineraries) goes to the network.
});
