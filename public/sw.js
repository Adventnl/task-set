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
