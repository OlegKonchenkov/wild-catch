// WildCatch Service Worker
// Cache strategy:
//   _next/static/*  → cache-first (immutable, fingerprinted by Next.js)
//   images          → stale-while-revalidate (creature artwork etc.)
//   HTML pages      → network-first (always fresh on new deploy)
//   /api/*          → network-only (never cache game data)

const STATIC_CACHE  = 'wc-static-v4'
const IMAGE_CACHE   = 'wc-images-v4'
const MAX_IMG_CACHE = 80

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
}

function isImageAsset(url) {
  return (
    url.hostname.endsWith('.supabase.co') ||
    /\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname)
  )
}

// Install: pre-cache manifest, skip waiting immediately
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(['/manifest.json']).catch(() => {}))
  )
})

// Activate: delete ALL old caches (v1 and any other stale name), claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== IMAGE_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Only handle GET — Cache API does not support PUT/POST/DELETE requests
  if (event.request.method !== 'GET') return

  // Only handle http/https — skip chrome-extension://, data:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // API: always network, never cache
  if (url.pathname.startsWith('/api/')) return

  // Immutable static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone())
            return res
          })
        })
      )
    )
    return
  }

  // Images (creature artwork): stale-while-revalidate
  if (isImageAsset(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(event.request)
        const networkFetch = fetch(event.request).then(async res => {
          if (res.ok) {
            // Clone immediately before any async gap
            const clone = res.clone()
            const keys = await cache.keys()
            if (keys.length >= MAX_IMG_CACHE) await cache.delete(keys[0])
            cache.put(event.request, clone)
          }
          return res
        }).catch(() => null)
        // Return cached immediately, update in background
        return cached ?? networkFetch
      })
    )
    return
  }

  // HTML pages: network-first (ensures new deploys are always picked up)
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) {
          // Clone synchronously before returning res (body consumed by browser)
          const clone = res.clone()
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

// Allow app to trigger SW update programmatically
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
