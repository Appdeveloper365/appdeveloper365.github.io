/**
 * sw.js — TVPlay service worker
 * Caches the app shell so the UI opens instantly (and the bundled
 * sports playlist keeps working offline). Remote channel streams and
 * third-party playlists are never cached — they must stay live.
 */

const CACHE = 'tvplay-v12';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/player.js',
  './js/playlist.js',
  './js/channels.js',
  './js/settings.js',
  './js/health.js',
  './lib/hls.min.js',
  './assets/sports-world.m3u',
  './assets/news-world.m3u',
  './js/trim.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // Cross-origin: remote playlists & streams — always go to network.
    return;
  }

  // Network-first for the document so updates land immediately;
  // fall back to cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for everything else (css/js/lib/icons/playlist).
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      });
    })
  );
});
