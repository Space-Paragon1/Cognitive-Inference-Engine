/* CLR service worker: keeps the app itself available offline and quick to open.
   vite.config.ts writes dist/sw.js from this file, filling in the app's files and a
   version that changes whenever any of them does. The engine is another origin and
   is never cached here: live load, tasks and settings always come from it. */

const VERSION = "__VERSION__";
const SHELL = __SHELL__;
const CACHE = `clr-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// A new release replaces the previous one's files.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("clr-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Opening the app: the network first, so a new release shows up straight away,
  // and the saved copy when offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  // The app's files: the saved copy first. Files under /assets carry a content hash,
  // so a saved one is never out of date; ones not saved yet (other font alphabets)
  // are kept after their first use.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && url.pathname.startsWith("/assets/")) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
