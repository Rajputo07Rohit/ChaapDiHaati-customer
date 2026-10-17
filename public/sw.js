/* Customer app service worker: order-update push notifications, and a usable
 * app on a weak connection (the app shell and built assets are cached; the API
 * never is — prices, store status and orders always come live from the server). */

const CACHE = "cdh-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;

  // Page loads: always try the network (fresh deploys show up), fall back to the cached shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Hashed build assets never change — cache-first. Menu photos: cache after first view.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/menu/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Order update", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Order update", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      tag: data.tag || undefined,
      renotify: true,
      data: { url: data.url || "/orders" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/orders", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
