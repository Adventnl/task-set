// Task Set service worker. It keeps the app shell available offline and never touches /api:
// data lives in IndexedDB and syncs through the page, not through this cache.

const CACHE = 'task-set-shell-v1'
const STATIC = ['/manifest.webmanifest', '/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

function assetPaths(html) {
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
}

/** Stores the latest page and drops hashed assets that the page no longer references. */
async function storePage(response) {
  const cache = await caches.open(CACHE)
  const html = await response.clone().text()
  const keep = new Set(assetPaths(html))
  await cache.put('/', response)
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname
    if (path.startsWith('/assets/') && !keep.has(path)) await cache.delete(request)
  }
  return [...keep]
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch('/', { cache: 'no-cache' })
      if (!response.ok) throw new Error(`Could not load the app shell (${response.status})`)
      const assets = await storePage(response)
      await (await caches.open(CACHE)).addAll([...assets, ...STATIC])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name)
      await self.clients.claim()
    })(),
  )
})

async function page(event) {
  try {
    const response = await fetch(event.request)
    if (response.ok && (response.headers.get('content-type') ?? '').includes('text/html')) {
      event.waitUntil(storePage(response.clone()))
    }
    return response
  } catch {
    return (await caches.match('/')) ?? Response.error()
  }
}

// Hashed assets never change, so the cached copy is always right.
async function asset(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await (await caches.open(CACHE)).put(request, response.clone())
  return response
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) await (await caches.open(CACHE)).put(request, response.clone())
    return response
  } catch {
    return (await caches.match(request)) ?? Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') event.respondWith(page(event))
  else if (url.pathname.startsWith('/assets/')) event.respondWith(asset(request))
  else event.respondWith(networkFirst(request))
})
