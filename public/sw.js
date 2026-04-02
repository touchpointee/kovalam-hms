const VERSION = "hms-sw-1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || "/hospital-logo.png",
    badge: "/hospital-logo.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/laboratory/dashboard",
    },
    actions: [{ action: "open", title: "Open Laboratory" }],
    requireInteraction: true,
    tag: data.tag || "lab-bill",
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) =>
        Promise.all(
          clientList.map((client) =>
            client.postMessage({
              type: "lab-bill-push",
              payload: data,
            })
          )
        )
      ),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/laboratory/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
      return undefined;
    })
  );
});
