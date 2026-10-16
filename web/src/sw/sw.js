/* Service worker (FR-51, FR-53). The build prepends:
 *   const VERSION = "<hash of the build files>";
 *   const PRECACHE = ["./", "index.html", "assets/...", ...];
 *
 * App files: cache first (precached at install, so the app opens offline).
 * Term data (data/*.json): network first with a timeout, then the last copy,
 * so new data arrives when online and the last data works offline.
 * The A9 probe (probe/*) is never cached.
 * Matches ignore Vary: servers send "Vary: Origin", and module script requests carry an
 * Origin header that the install-time requests did not, so nothing would match offline.
 */
/* global VERSION, PRECACHE */

const SHELL = `vahedchin-shell-${VERSION}`;
const DATA = "vahedchin-data";
const NETWORK_TIMEOUT_MS = 5000;
const BASE = new URL(self.registration.scope).pathname; // "/vahedchin/"

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL).then((cache) => cache.addAll(PRECACHE.map((path) => new Request(path, { cache: "reload" })))),
      // The first page load is not controlled yet, so its data fetch is not cached;
      // cache the published terms now so the app works offline after the first visit.
      cacheTerms().catch(() => {}),
    ]),
  );
});

async function cacheTerms() {
  const cache = await caches.open(DATA);
  const indexUrl = new URL("data/index.json", self.registration.scope).href;
  const res = await fetch(indexUrl, { cache: "no-cache" });
  if (!res.ok) return;
  await cache.put(indexUrl, res.clone());
  const { terms } = await res.json();
  await Promise.all(
    terms.map(async (t) => {
      const url = new URL(`data/${t.file}`, self.registration.scope).href;
      const r = await fetch(url, { cache: "no-cache" });
      if (r.ok) await cache.put(url, r);
    }),
  );
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("vahedchin-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const path = url.pathname.slice(BASE.length);
  if (path.startsWith("probe/")) return;
  if (path.startsWith("data/")) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(caches.match(BASE, { cacheName: SHELL, ignoreVary: true }).then((hit) => hit || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(request)));
});

async function networkFirst(request) {
  const cache = await caches.open(DATA);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)),
    ]);
    if (response.ok) await cache.put(request.url.split("?")[0], response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request.url.split("?")[0], { ignoreVary: true });
    if (hit) return hit;
    throw error;
  }
}
