// sw.js — the service worker: keeps a copy of the app so it opens offline.
//
// SHIPPING AN UPDATE: change VERSION (any new value), then deploy.
// The app notices, downloads the new files in the background and offers "Update".
// If you add a new file to the app, add it to FILES too.

const VERSION = '1.2.0';
const CACHE = `dawn-${VERSION}`;
const FILES = [
  './', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/store.js', './js/dates.js', './js/logic.js', './js/ui.js', './js/starter.js',
  './js/views/today.js', './js/views/week.js', './js/views/stats.js', './js/views/habits.js', './js/views/edit.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './img/grain.png', './fonts/bodoni-moda-900.woff2', './fonts/bodoni-moda-700.woff2', './fonts/anton-400.woff2',
  './fonts/space-mono-400.woff2', './fonts/space-mono-700.woff2', './fonts/weekdays-jp.woff2',
];

// Two strategies:
//  - Online (GitHub Pages etc.): cache first. The app opens instantly, with or without a connection,
//    and only changes when you ship a new VERSION.
//  - On your own computer (localhost): network first, so a normal reload shows your latest edits.
//    The cache is still kept up to date, so you can test offline mode locally too.
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache, so we never store stale files.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('dawn-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// The page sends this when you tap "Update".
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(LOCAL ? networkFirst(request) : cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch (err) {
    return offlineFallback(request, err);
  }
}

async function networkFirst(request) {
  try {
    // Page loads keep the browser's own reload behaviour; other files always ask the server.
    const response = await fetch(request.mode === 'navigate' ? request : new Request(request, { cache: 'no-cache' }));
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
    }
    return response;
  } catch (err) {
    return (await caches.match(request, { ignoreSearch: true })) ?? offlineFallback(request, err);
  }
}

// Offline and not in the cache: any page address gets the app itself.
function offlineFallback(request, err) {
  if (request.mode === 'navigate') return caches.match('./');
  throw err;
}
