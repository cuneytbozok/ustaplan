// UstaPlan service worker (plan §9, M5.5). Deliberately small:
// - offline fallback page for artisan navigations only;
// - never caches HTML, API responses or anything else from the network;
// - leaves customer links (/t/*, /api/t/*) completely alone;
// - shows Web Push notifications and opens the right page on tap.
// Push payload (sent from lib/push in M5.7): { title, body, url, tag }.

const CACHE = "ustaplan-offline-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/t/")) return;
  // Network only; the cached page is shown only when the network fails.
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});

/** Same-origin path only, so a payload can never send the user elsewhere. */
function safePath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/bildirimler";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "UstaPlan";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "tr",
      // Same tag = the same event; a repeat replaces instead of stacking.
      tag: typeof data.tag === "string" && data.tag ? data.tag : undefined,
      data: { url: safePath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const target = new URL(path, self.location.origin).href;
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
          await client.navigate(target);
          return;
        } catch {
          break; // not controlled by this worker yet: open a fresh window instead
        }
      }
      await self.clients.openWindow(target);
    }),
  );
});
