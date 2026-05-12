// Daimon Service Worker
// Cache strategy:
//   _next/static/*        -> cache-first (immutable, fingerprinted by Next.js)
//   icons + login-bg      -> precached on install (app-shell cold start)
//   creature images       -> stale-while-revalidate, LRU eviction
//   basemap tiles (carto) -> stale-while-revalidate, longer LRU window
//   HTML pages            -> network-first with offline fallback
//   APIs/JSON/Supabase    -> network-only (never cache live game data)

const STATIC_CACHE = 'wc-static-v6'
const IMAGE_CACHE  = 'wc-images-v6'
const TILE_CACHE   = 'wc-tiles-v6'
const KNOWN_CACHES = [STATIC_CACHE, IMAGE_CACHE, TILE_CACHE]

const MAX_IMG_CACHE  = 80
const MAX_TILE_CACHE = 250   // ~1-2 MB total, enough for a session's map area
const OFFLINE_URL    = '/offline.html'

// Precached at install time so a cold launch paints the shell immediately
// even before the browser asks for these resources.
const PRECACHE_URLS = [
  '/manifest.json',
  '/offline.html',
  '/login-bg.webp',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

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

function isMapTile(url) {
  // CartoDB basemap subdomains: a-d.basemaps.cartocdn.com
  return url.hostname.endsWith('.basemaps.cartocdn.com')
}

function isNetworkOnlyRequest(url, request) {
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return true
  // Supabase REST/Auth/Realtime/functions are dynamic and must never be cached.
  // Keep Supabase Storage object requests cacheable for artwork/images.
  if (url.hostname.endsWith('.supabase.co') && !url.pathname.startsWith('/storage/v1/object/')) {
    return true
  }
  const accept = request.headers.get('accept') || ''
  if (accept.includes('application/json') || accept.includes('text/event-stream')) return true
  return false
}

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => Promise.allSettled(PRECACHE_URLS.map(u => cache.add(u))))
      .catch(() => {})
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !KNOWN_CACHES.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

async function lruPut(cache, request, response, maxEntries) {
  if (!response.ok) return
  const clone = response.clone()
  const keys = await cache.keys()
  if (keys.length >= maxEntries) {
    // Drop the oldest few in one batch to amortise eviction cost.
    const toEvict = Math.max(1, Math.floor(maxEntries * 0.1))
    for (let i = 0; i < toEvict && i < keys.length; i++) await cache.delete(keys[i])
  }
  await cache.put(request, clone)
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  if (event.request.method !== 'GET') return
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return
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

  // Map tiles: SWR with separate cache + larger budget
  if (isMapTile(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(event.request)
        const networkFetch = fetch(event.request)
          .then(res => { void lruPut(cache, event.request, res, MAX_TILE_CACHE); return res })
          .catch(() => null)
        return cached ?? networkFetch
      })
    )
    return
  }

  // Generic images (creature artwork etc.): SWR
  if (isImageAsset(url, event.request)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(event.request)
        const networkFetch = fetch(event.request)
          .then(res => { void lruPut(cache, event.request, res, MAX_IMG_CACHE); return res })
          .catch(() => null)
        return cached ?? networkFetch
      })
    )
    return
  }

  // HTML documents: network-first, cached fallback, offline page as last resort
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
        .catch(async () => {
          const cached = await caches.match(event.request)
          if (cached) return cached
          const offline = await caches.match(OFFLINE_URL)
          if (offline) return offline
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        })
    )
  }
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
