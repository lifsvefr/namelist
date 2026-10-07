/* Myndasögur service worker — offline shelf, careful cache (never caches failures) */
const CACHE = 'myndasogur-v3';
const CORE = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(r) {
  return r && (r.ok || r.type === 'opaque'); // opaque = cross-origin CDN scripts
}

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000))
    ]);
    if (cacheable(r)) c.put(req, r.clone());
    return r;
  } catch (e) {
    const m = await c.match(req) || await c.match('./');
    if (m) return m;
    throw e;
  }
}

async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const m = await c.match(req);
  if (m) return m;
  const r = await fetch(req);
  if (cacheable(r)) c.put(req, r.clone());
  return r;
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') { e.respondWith(networkFirst(e.request)); return; }
  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(e.request));
  }
});
