/* Doctiling Chat service worker (spec 045 FR-023, FR-024).
 *
 * - Precaches the shell so the installed app opens without network.
 * - Navigations are network-first; without network they get /offline.html.
 * - /api/*, /connect/* and ANY request carrying Authorization are never cached
 *   and never served from cache: business data does not live on the device.
 * - Versioned static assets are cache-first.
 * - A new worker waits until the page posts SKIP_WAITING (the "Update" toast);
 *   no skipWaiting on install, so an update never interrupts a conversation.
 *
 * server/serve.mjs rewrites __SW_VERSION__ with the package version so every
 * release gets its own cache; the Vite dev server never registers this file.
 */
const VERSION = '__SW_VERSION__';
const SHELL_CACHE = `doctiling-chat-shell-${VERSION}`;
const ASSET_CACHE = `doctiling-chat-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const SHELL = ['/', '/index.html', OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-192.png', '/icons/maskable-512.png'];

function neverCache(request, url) {
  if (request.method !== 'GET') return true;
  if (request.headers && request.headers.has && request.headers.has('authorization')) return true;
  if (url.pathname.startsWith('/api/')) return true;
  if (url.pathname.startsWith('/connect/')) return true;
  if (url.pathname === '/health') return true;
  if (url.pathname === '/sw.js') return true;
  return false;
}

function isStaticAsset(url) {
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || /\.(js|css|png|svg|woff2?|webmanifest)$/.test(url.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        SHELL.map((path) =>
          cache.add(new Request(path, { cache: 'reload' })).catch(() => {
            /* a missing icon must not break the install */
          }),
        ),
      ),
    ),
  );
  // Deliberately no self.skipWaiting(): the page decides (FR-024).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('doctiling-chat-') && k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Same-origin responses only ('basic' in browsers, 'default' in tests); never an opaque one.
  if (res && res.ok && (res.type === 'basic' || res.type === 'default')) cache.put(request, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return; // the API lives on another origin: untouched
  if (neverCache(request, url)) return; // falls through to the network, no respondWith
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstAsset(request));
  }
});
