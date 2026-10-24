// Opening Task Set always requires a live server session check. Never serve a cached shell.
self.addEventListener('install', (event) => { event.waitUntil(self.skipWaiting()) })
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('task-set-shell-')) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', (event) => {
  if (new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }))
  }
})

// Private summaries only; bank details are loaded after the app's normal session check.
self.addEventListener('push', (event) => {
  let message
  try { message = event.data.json() } catch { return }
  event.waitUntil(self.registration.showNotification(String(message.title || 'Finances'), {
    body: String(message.body || 'Transactions are available to review.'),
    tag: String(message.tag || 'finance'), icon: '/icons/icon-192.png',
    data: { url: typeof message.url === 'string' && /^\/#finance(?:\/[^?#]*)?$/.test(message.url) ? message.url : '/#finance' },
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/#finance', self.location.origin)
    if (target.origin !== self.location.origin) return
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin) { await client.navigate(target.href); return client.focus() }
    }
    return self.clients.openWindow(target.href)
  })())
})
