const VERSION = "beeking-v1";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const DATA = `data-${VERSION}`;
const PRECACHE = ["/", "/images/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isDataRequest(url) {
  return url.pathname.endsWith("/__data.json") || url.pathname === "/__data.json";
}

function dataKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete("x-sveltekit-invalidated");
  return url.href;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName, key, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(key ?? request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(key ?? request);
    if (cached) return cached;
    if (fallbackKey) {
      const fallback = await cache.match(fallbackKey);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response.ok && response.type === "basic")
        return cache.put(request, response.clone()).then(() => response);
      return response;
    })
    .catch(() => cached);
  return cached ?? update;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES, request, "/"));
    return;
  }
  if (url.pathname.startsWith("/_app/immutable/")) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }
  if (isDataRequest(url)) {
    event.respondWith(networkFirst(request, DATA, dataKey(request)));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, ASSETS));
});
