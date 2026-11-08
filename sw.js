/* Service worker Jejak Resit: aplikasi dibuka tanpa internet selepas lawatan pertama. */
var VERSION = 'jejak-resit-v1';
var RUNTIME = VERSION + '-rt';
var CORE = [
  './', 'index.html', 'styles.css', 'extra.css', 'parse.js', 'app.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'
];
var EXTERNAL = /(^|\.)(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|tessdata\.projectnaptha\.com)$/;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== RUNTIME; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith(
        fetch(req).then(function (r) {
          var copy = r.clone();
          caches.open(VERSION).then(function (c) { c.put('index.html', copy); });
          return r;
        }).catch(function () { return caches.match('index.html', { ignoreSearch: true }); })
      );
      return;
    }
    e.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(function (r) {
          if (r && r.ok) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
          return r;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
    return;
  }

  if (EXTERNAL.test(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (r) {
            if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone());
            return r;
          });
        });
      })
    );
  }
});
