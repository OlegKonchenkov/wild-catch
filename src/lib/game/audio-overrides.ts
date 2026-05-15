/**
 * Admin-managed audio overrides.
 *
 * Each game audio "slot" (map ambience, encounter, duel, boss, intro) has a
 * default procedural synth path. The admin can upload an mp3 per slot — when
 * present and enabled, the playback helpers route to that file instead.
 *
 * This module is the synchronous read surface used by playback helpers.
 * `hydrateAudioOverrides(sessionId)` is called once on session boot
 * (see GameShell) and populates the cache; after that, `getAudioOverride(slot)`
 * returns the resolved URL (or null) instantly.
 *
 * Precedence: per-session row wins over global row.
 */

export type AudioSlot = 'map' | 'encounter' | 'duel' | 'boss' | 'intro'

const cache = new Map<AudioSlot, string>()
let hydratedFor: string | null = null
let inFlight: Promise<void> | null = null

export function getAudioOverride(slot: AudioSlot): string | null {
  return cache.get(slot) ?? null
}

/**
 * Fetch overrides for the given session and populate the cache. Idempotent
 * per session id — repeated calls with the same sessionId are no-ops.
 * On error: silently keep whatever was in the cache (defaults will be used).
 */
export async function hydrateAudioOverrides(sessionId: string | null | undefined): Promise<void> {
  if (typeof window === 'undefined') return
  if (!sessionId) return
  if (hydratedFor === sessionId) return
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const res = await fetch(`/api/game/audio-overrides?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = (await res.json()) as { overrides?: Array<{ slot: AudioSlot; file_url: string }> }
      cache.clear()
      for (const row of data.overrides ?? []) {
        cache.set(row.slot, row.file_url)
      }
      hydratedFor = sessionId
    } catch {
      // best-effort; keep cache as-is
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/**
 * Clear the cache. Call when the player switches session or logs out so the
 * next hydrate picks up the right overrides.
 */
export function clearAudioOverrides(): void {
  cache.clear()
  hydratedFor = null
}
