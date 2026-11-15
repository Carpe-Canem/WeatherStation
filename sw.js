// Keeps the app shell available offline. Weather data is never cached here;
// the app stores its own last readings.
const CACHE = 'backyard-shell-v25';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/charts.js', 'js/demo.js', 'js/units.js', 'js/wu.js', 'js/reorder.js', 'js/conditions.js', 'js/sky.js', 'js/dogs.js', 'js/sprites.js', 'js/holidays.js', 'js/outfits.js', 'js/changelog.js', 'js/seasons.js',
  'fonts/manrope.woff2',
  'icons/icon-192.png?v=2', 'icons/apple-touch-icon.png?v=2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first so updates show up straight away; fall back to the cache when offline.
// 'no-cache' makes the browser check with the server every time, so its own HTTP
// cache (GitHub Pages allows 10 minutes) can't hand back an old file.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))),
  );
});
