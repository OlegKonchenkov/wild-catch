// WildCatch Service Worker
// Cache strategy:
//   _next/static/*  -> cache-first (immutable, fingerprinted by Next.js)
//   images          -> stale-while-revalidate (creature artwork etc.)
//   HTML pages      -> network-first (always fresh on new deploy)
//   APIs/JSON       -> network-only (never cache game data)

const STATIC_CACHE = 'wc-static-v5'
const IMAGE_CACHE = 'wc-images-v5'
const MAX_IMG_CACHE = 80

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))
  )
}

function isImageAsset(url, request) {
  if (request.destination === 'image') return true
  return /\.(png|jpg|jpeg|webp|gif|svg|ico|avif)$/i.test(url.pathname)
}

function isNetworkOnlyRequest(url, request) {
  // Local API routes
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return true

  // Supabase REST/Auth/Realtime/functions are dynamic and must never be cached.
  // Keep Supabase Storage object requests cacheable for artwork/images.
  if (url.hostname.endsWith('.supabase.co') && !url.pathname.startsWith('/storage/v1/object/')) {
    return true
  }

  // JSON/SSE fetches should always hit network.
  const accept = request.headers.get('accept') || ''
  if (accept.includes('application/json') || accept.includes('text/event-stream')) return true

  return false
}

// Install: pre-cache manifest, skip waiting immediately
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(['/manifest.json']).catch(() => {}))
  )
})

// Activate: delete all old caches except current names, claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== IMAGE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Only handle GET (Cache API does not support PUT/POST/DELETE requests)
  if (event.request.method !== 'GET') return

  // Only handle http/https (skip chrome-extension://, data:, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // Dynamic/API-like requests: always network, never cache
  if (isNetworkOnlyRequest(url, event.request)) return

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
  if (isImageAsset(url, event.request)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(event.request)
        const networkFetch = fetch(event.request)
          .then(async res => {
            if (res.ok) {
              const clone = res.clone()
              const keys = await cache.keys()
              if (keys.length >= MAX_IMG_CACHE) await cache.delete(keys[0])
              cache.put(event.request, clone)
            }
            return res
          })
          .catch(() => null)

        // Return cached immediately, update in background
        return cached ?? networkFetch
      })
    )
    return
  }

  // HTML documents only: network-first (ensures new deploys are always picked up)
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(STATIC_CACHE).then(c => c.put(event.request, clone))
          }
          return res
        })
        .catch(() => caches.match(event.request))
    )
  }
})

// Allow app to trigger SW update programmatically
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

