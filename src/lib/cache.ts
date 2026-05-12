// Tiny localStorage-backed stale-while-revalidate cache.
//
// Use for read-mostly, near-static tables (creatures, items, level configs).
// Returns cached data instantly when fresh, kicks off a background refresh,
// and falls back to a live fetch when nothing is cached or the cache is past
// its TTL.
//
// Schema: { v: 1, ts: <ms>, data: T }. Bumping `CACHE_VERSION` invalidates
// every entry — use when on-disk shape would otherwise be misread.

'use client'

const CACHE_VERSION = 1
const PREFIX = 'wc:cache:'

interface CacheEnvelope<T> {
  v: number
  ts: number
  data: T
}

function read<T>(key: string): CacheEnvelope<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (parsed?.v !== CACHE_VERSION || typeof parsed.ts !== 'number') return null
    return parsed
  } catch { return null }
}

function write<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    const env: CacheEnvelope<T> = { v: CACHE_VERSION, ts: Date.now(), data }
    localStorage.setItem(PREFIX + key, JSON.stringify(env))
  } catch {
    // Quota exceeded or storage disabled — silently skip. Caller still has
    // the freshly-fetched data via the returned promise.
  }
}

export function invalidate(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(PREFIX + key) } catch {}
}

export interface SWRResult<T> {
  /** Cached value if any. */
  cached: T | null
  /** Promise resolving to the authoritative value (cache hit → resolves quickly with revalidated data; miss → identical to a normal fetch). */
  fresh: Promise<T>
}

/**
 * Stale-while-revalidate:
 *  - If a fresh entry exists (within ttlMs), return it as `cached` and
 *    revalidate in the background. `fresh` resolves once revalidation lands.
 *  - If only a stale entry exists, return it as `cached` and refetch.
 *  - If nothing is cached, `cached` is null and `fresh` performs a live fetch.
 *
 * Callers typically paint `cached` immediately and await `fresh` to update.
 */
export function swr<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): SWRResult<T> {
  const entry = read<T>(key)
  const isFresh = !!entry && Date.now() - entry.ts < ttlMs

  const fresh = (async () => {
    // Skip the network round-trip when we already have a fresh hit — saves
    // bandwidth on rapid back-navigations to the same page.
    if (isFresh) return entry!.data
    try {
      const data = await loader()
      write(key, data)
      return data
    } catch (err) {
      if (entry) return entry.data
      throw err
    }
  })()

  return { cached: entry?.data ?? null, fresh }
}
