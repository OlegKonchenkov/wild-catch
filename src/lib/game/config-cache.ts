import { createAdminClient } from '@/lib/supabase/admin'
import type { Rarity } from '@/lib/types'

// In-memory per-instance cache with TTL. Vercel Fluid Compute reuses function
// instances across requests, so once a hot endpoint warms the cache, subsequent
// requests on the same instance skip the DB entirely. Cold starts pay the read.
// All cached datasets here are global/read-mostly config that rarely changes
// (admin edits via dashboard) — a few minutes of staleness is fine.

const TTL_MS = 5 * 60 * 1000 // 5 minutes
type Entry<T> = { value: T; expiresAt: number }
const store = new Map<string, Entry<unknown>>()

async function memo<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && hit.expiresAt > Date.now()) return hit.value
  const value = await fetcher()
  store.set(key, { value, expiresAt: Date.now() + TTL_MS })
  return value
}

/** PostgREST filter for "belongs to this event, or is part of the global
 *  catalogue". `creatures.session_id IS NULL` means the creature spawns
 *  everywhere; a non-null one is exclusive to that event.
 *
 *  Note this deliberately does NOT use `scopedSessionOrFilter` from
 *  lib/game/tutorial.ts. That helper isolates the tutorial completely
 *  (session-scoped rows only), which is right for missions/items/QR/enigmi
 *  because those have tutorial-specific rows seeded — but there are no
 *  tutorial-scoped creatures, so isolating here would leave the tutorial with
 *  an empty spawn pool. */
function sessionScope(sessionId: string): string {
  return `session_id.eq.${sessionId},session_id.is.null`
}

/** Spawnable creatures pool used by encounter/start for RNG selection.
 *
 *  Scoped to the session. This used to fetch the entire `spawnable` catalogue
 *  under a single global cache key, so creatures authored as exclusive to one
 *  event spawned at every other event too — which both breaks the "Daimon
 *  dedicated to your territory" promise the per-event catalogue exists for,
 *  and dilutes completion for the player. */
export async function getSpawnableCreatures(sessionId: string) {
  return memo(`creatures-spawnable:${sessionId}`, async () => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('creatures')
      .select('id, spawn_weight, rarity, min_level, hp, element')
      .eq('spawnable', true)
      .or(sessionScope(sessionId))
    return (data ?? []) as Array<{ id: string; spawn_weight: number; rarity: Rarity; min_level: number; hp: number; element: string }>
  })
}

/** Starter creatures (comune spawnable) shown to new players. Same scoping as
 *  the spawn pool — an event with its own starters shouldn't offer another
 *  event's. */
export async function getStarterCreatures(sessionId: string) {
  return memo(`creatures-starters:${sessionId}`, async () => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('creatures')
      .select('id, name, rarity, element, image_url, sprite_cutout_url, sprite_url, hp, atk, def, description')
      .eq('rarity', 'comune')
      .eq('spawnable', true)
      .or(sessionScope(sessionId))
      .order('name')
    return data ?? []
  })
}

/** Global catch rate config (admin-tunable). */
export async function getGlobalCatchConfig() {
  return memo('global-catch-config', async () => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('global_catch_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    return data
  })
}

/** Optional escape hatch when an admin edits a cached table and wants the next
 *  request to see the change immediately. Call from admin write routes. */
export function invalidateConfigCache(key?: 'creatures' | 'catch-config' | 'all') {
  if (!key || key === 'all') { store.clear(); return }
  if (key === 'creatures') {
    // Creature entries are keyed per session (`creatures-spawnable:<id>`), so
    // drop every entry with that prefix rather than a single fixed key — an
    // admin editing the catalogue has no idea which sessions are warm.
    for (const k of store.keys()) {
      if (k.startsWith('creatures-spawnable:') || k.startsWith('creatures-starters:')) store.delete(k)
    }
  }
  if (key === 'catch-config') store.delete('global-catch-config')
}
