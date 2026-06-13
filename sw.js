/** Incrémenter à chaque déploiement important (CSS/JS) pour vider les caches iOS/PWA */
const BUILD = '24';
const CACHE = `trading-journal-${BUILD}`;

const OFFLINE_URLS = ['./icons/icon.svg', './manifest.webmanifest'];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAppAsset(pathname) {
  return /\.(html|css|js)$/i.test(pathname) || pathname.endsWith('/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/** Réseau d'abord pour HTML/CSS/JS — évite l'ancien design bloqué sur iOS */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!isSameOrigin(url)) return;

  if (!isAppAsset(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached || caches.match('./index.html')
        )
      )
  );
});
