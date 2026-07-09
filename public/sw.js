/* global self, clients */

/**
 * Admin push service worker (6.17). Registered from Settings → Notifications;
 * shows system notifications for pushes sent by lib/push/send.ts (payload
 * shape: AdminPushPayload) and focuses/opens the admin console on tap.
 */

self.addEventListener("push", (event) => {
  const fallback = { title: "JR Jewellers", body: "Something needs your attention.", url: "/admin" }
  let payload = fallback
  try {
    payload = { ...fallback, ...event.data.json() }
  } catch {
    /* Malformed payload — show the fallback rather than nothing. */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/admin"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const adminWindow = windows.find((win) => win.url.includes("/admin"))
      if (adminWindow) {
        adminWindow.navigate(url)
        return adminWindow.focus()
      }
      return clients.openWindow(url)
    }),
  )
})
