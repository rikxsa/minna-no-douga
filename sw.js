// Service Worker — app shell cache + Web Push handler

const CACHE = "fls-shell-v3";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./icon.webp",
  "./manifest.webmanifest",
  "./about.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Skip the SW itself + worker subscription endpoints (none on this origin anyway)
  if (url.pathname.endsWith("/sw.js")) return;

  // Network-first for fresh data
  if (url.pathname.includes("/data/")) {
    event.respondWith(networkFirst(req));
    return;
  }
  // Stale-while-revalidate for shell + page navigation
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  try {
    const r = await fetch(req);
    if (r.ok) {
      const c = await caches.open(CACHE);
      c.put(req, r.clone());
    }
    return r;
  } catch (e) {
    const hit = await caches.match(req);
    return hit || new Response('{"offline":true}', {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(CACHE);
  const cached = await c.match(req);
  const fresh = fetch(req).then((r) => {
    if (r && r.ok) c.put(req, r.clone());
    return r;
  }).catch(() => null);

  if (cached) {
    fresh.catch(() => {});
    return cached;
  }
  const r = await fresh;
  return r || new Response("offline", { status: 503 });
}

// =================== Web Push ===================

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "みんなの動画", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "みんなの動画";
  const body = data.body || "";
  const url = data.url || "/";
  const tag = data.tag || "fls-default";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "icon.webp",
      badge: "icon.webp",
      tag,
      data: { url },
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })()
  );
});
