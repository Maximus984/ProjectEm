const CACHE_NAME = "projectm-shell-v4";
const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");

const withScope = (path) => `${scopePath}${path}`;

const STATIC_ASSETS = [
  withScope("/"),
  withScope("/index.html"),
  withScope("/manifest.webmanifest"),
  withScope("/icons/icon-192.png"),
  withScope("/icons/icon-512.png"),
  withScope("/icons/icon-maskable-192.png"),
  withScope("/icons/icon-maskable-512.png"),
  withScope("/branding/maxx-forge-mark.png"),
  withScope("/branding/maxx-forge-logo.png")
];

const INDEX_FALLBACK = withScope("/index.html");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.includes("/api/")) {
    event.respondWith(fetch(request).catch(() => caches.match(INDEX_FALLBACK)));
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, clone))
            .catch(() => Promise.resolve());
          return networkResponse;
        })
        .catch(() => caches.match(INDEX_FALLBACK));
    })
  );
});
