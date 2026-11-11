/* Service worker: guarda la "carcasa" de la app para que abra rápido y funcione aunque la señal sea mala.
   NUNCA guarda datos del sistema: las llamadas a la API (otro origen) no pasan por aquí.
   Al cambiar archivos de la app, suba el número de VERSION para que los celulares los actualicen. */
var VERSION = 'sgi-movil-1.0.0';
var ARCHIVOS = ['./', 'index.html', 'app.css', 'config.js', 'lib.js', 'api.js', 'demo.js', 'scanner.js', 'app.js',
  'vendor/jsQR.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // API de Google, inicio de sesión: directo a la red
  // Red primero (para recibir actualizaciones); si no hay señal, lo guardado.
  e.respondWith(fetch(req).then(function (resp) {
    if (resp && resp.ok) { var copia = resp.clone(); caches.open(VERSION).then(function (c) { c.put(req, copia); }); }
    return resp;
  }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match('index.html'); }); }));
});
