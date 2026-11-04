/* Cache the public application shell and static assets; never authenticated data. */
const CACHE = 'smartschool-shell-v2';
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('smartschool-') && name !== CACHE).map(name => caches.delete(name)))));
  self.clients.claim();
});
self.addEventListener('message', event => {
  if (event.data?.type === 'CLEAR_PRIVATE_CACHES') event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('smartschool-')).map(name => caches.delete(name)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization') || /^\/(?:api|auth)(?:\/|$)/.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.headers.get('content-type')?.includes('text/html')) void caches.open(CACHE).then(cache => cache.put('/index.html', response.clone()));
      return response;
    }).catch(() => caches.match('/index.html').then(response => response || caches.match('/'))));
    return;
  }
  // XHR/fetch requests have no destination and must always use the network.
  if (!['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) return;
  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response.ok) void caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => cached || Response.error());
    return cached || network;
  }));
});

