const VERSION = 'v4';
const CACHE = `loveall-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './src/app.js',
  './src/router.js',
  './src/theme.js',
  './src/persistence.js',
  './src/state.js',
  './src/scheduler.js',
  './src/cost.js',
  './src/elo.js',
  './src/rng.js',
  './src/ui/setup.js',
  './src/ui/live.js',
  './src/ui/summary.js',
  './src/ui/settings.js',
  './src/ui/player.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
