const SW_VERSION = 'tg-crm-sw-v1'
const STATIC_CACHE = `${SW_VERSION}-static`
const PAGE_CACHE = `${SW_VERSION}-pages`

function isSameOrigin(requestUrl) {
  return new URL(requestUrl).origin === self.location.origin
}

function isApiOrWs(pathname) {
  return pathname.startsWith('/api/')
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([
      '/',
      '/site.webmanifest',
    ]).catch(() => undefined)),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
        .map((key) => caches.delete(key)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (!isSameOrigin(url.href)) return
  if (isApiOrWs(url.pathname)) return

  // Keep API/auth/ws out of SW cache to avoid stale sessions.
  const isNuxtAsset = url.pathname.startsWith('/_nuxt/')
  const isDocument = request.mode === 'navigate'

  // Network-first for HTML pages: avoids stale entry chunks after deploys.
  if (isDocument) {
    event.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE)
      try {
        const fresh = await fetch(request, { cache: 'no-store' })
        if (fresh.ok) {
          cache.put(request, fresh.clone())
        }
        return fresh
      } catch {
        const fallback = await cache.match(request)
        if (fallback) return fallback
        return caches.match('/')
      }
    })())
    return
  }

  // Stale-while-revalidate for hashed static assets.
  if (isNuxtAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE)
      const cached = await cache.match(request)
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone())
          }
          return response
        })
        .catch(() => cached)
      return cached || networkFetch
    })())
  }
})
