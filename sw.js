const CACHE_NAME = 'khedutconnect-v4';
const APP_SHELL = [
  '/', '/index.html', '/manifest.json',
  '/css/main.css', '/css/auth.css', '/css/dashboard.css',
  '/assets/khedut-logo.png',
  '/js/common.js', '/js/main.js', '/js/i18n.js', '/js/auth.js',
  '/js/dashboard.js', '/js/buyer.js', '/js/farmer.js', '/js/admin.js',
  '/pages/login.html', '/pages/register.html',
  '/pages/buyer-dashboard.html', '/pages/farmer-dashboard.html', '/pages/admin-dashboard.html'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});
