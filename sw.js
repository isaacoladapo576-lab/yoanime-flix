'use strict';

const APP_CACHE = 'yoanime-shell-v6';
const APP_SHELL = [
    '/',
    '/index.html',
    '/styles.css?v=19',
    '/stream-sources.js?v=10',
    '/app.js?v=20',
    '/manifest.webmanifest'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key.startsWith('yoanime-shell-') && key !== APP_CACHE)
                .map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (
        event.request.method !== 'GET' ||
        url.origin !== self.location.origin ||
        url.pathname.startsWith('/api/')
    ) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const copy = response.clone();
                caches.open(APP_CACHE).then(cache => cache.put(event.request, copy));
                return response;
            })
            .catch(() => caches.match(event.request).then(response => {
                if (response) return response;
                return event.request.mode === 'navigate' ? caches.match('/index.html') : undefined;
            }))
    );
});
