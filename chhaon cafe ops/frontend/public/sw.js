/* Chhaon Cafe Ops — offline app shell cache */
const CACHE = "chhaon-ops-v3";
const SHELL = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API or webpack bundles — stale SW + SPA fallback caused
  // "Unexpected token '<'" when /static/js/*.js returned cached index.html.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/static/")) return;

  const isDocument =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  if (!isDocument) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match("/index.html"))
  );
});
