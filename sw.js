// Alfonso Mira · Planning — modo sin conexión (generado por construir.py)
const VERSION = 'am-1795600419';
const PROPIOS = ['./', 'index.html', 'tema.css', 'tema-colores.css', 'puente.js', 'nube.js', 'mejoras.js', 'ficha_campos.js', 'firebase-config.js',
  'favicon.ico', 'site.webmanifest', 'img/logo-am.png', 'img/logo-am-marfil.png', 'img/favicon-16.png', 'img/favicon-32.png', 'img/apple-touch-icon.png', 'img/icon-192.png', 'img/icon-512.png'];
const EXTERNOS_CORS = ['https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js', 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js', 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js'];
const EXTERNOS = ['https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net/npm/chart.js@4', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap'];
// Solo se guardan copias de estos sitios; Firebase (datos e inicio de sesión) nunca pasa por aquí
const HOSTS = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com', 'cdn.sheetjs.com'];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSION).then(function (c) {
    const tareas = PROPIOS.map(function (u) { return c.add(u).catch(function () {}); })
      .concat(EXTERNOS_CORS.map(function (u) { return fetch(u, { mode: 'cors' }).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {}); }))
      .concat(EXTERNOS.map(function (u) { return fetch(u, { mode: 'no-cors' }).then(function (r) { return c.put(u, r); }).catch(function () {}); }));
    return Promise.all(tareas);
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (ev) {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const propio = url.origin === self.location.origin;
  if (!propio && HOSTS.indexOf(url.hostname) < 0) return;
  if (propio && url.pathname.endsWith('finca.html')) return;
  // Archivos de la app: primero la red (siempre la última versión); sin cobertura, la última copia guardada
  if (propio) {
    ev.respondWith(fetch(req).then(function (r) {
      if (r && r.ok) { const copia = r.clone(); caches.open(VERSION).then(function (c) { c.put(req.mode === 'navigate' ? 'index.html' : req, copia); }); }
      return r;
    }).catch(function () {
      return caches.match(req).then(function (x) { return x || caches.match(req.mode === 'navigate' ? 'index.html' : req, { ignoreSearch: true }); })
        .then(function (x) { return x || caches.match('index.html', { ignoreSearch: true }); });
    }));
    return;
  }
  // Librerías externas: la copia guardada al momento y se actualiza por detrás
  ev.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req).then(function (guardada) {
      const red = fetch(req).then(function (r) { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(function () { return guardada; });
      return guardada || red;
    });
  }));
});
