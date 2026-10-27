/*
 * Galaxy Airport Taxi service worker. It only shows a friendly offline page
 * when there is no connection: every page, price and booking always comes
 * from the live website, so the installed app never shows old content.
 */
const CACHE = "galaxy-offline-v1";
const OFFLINE_URL = "/offline";

/** The offline page and the stylesheets it needs, so it looks right with no connection. */
async function saveOfflinePage() {
  const cache = await caches.open(CACHE);
  const res = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
  if (!res.ok) return;
  const html = await res.clone().text();
  const styles = [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
  await cache.put(OFFLINE_URL, res);
  await cache.addAll([...new Set(styles)]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(saveOfflinePage());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  } else if (request.destination === "style" && new URL(request.url).pathname.startsWith("/_next/static/")) {
    // Network first; the saved copy only when offline.
    event.respondWith(fetch(request).catch(() => caches.match(request)));
  }
});
