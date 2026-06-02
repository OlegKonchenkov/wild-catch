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

/** Spawnable creatures pool used by encounter/start for RNG selection. */
export async function getSpawnableCreatures() {
  return memo('creatures-spawnable', async () => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('creatures')
      .select('id, spawn_weight, rarity, min_level, hp, element')
      .eq('spawnable', true)
    return (data ?? []) as Array<{ id: string; spawn_weight: number; rarity: Rarity; min_level: number; hp: number; element: string }>
  })
}

/** Starter creatures (comune spawnable) shown to new players. */
export async function getStarterCreatures() {
  return memo('creatures-starters', async () => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('creatures')
      .select('id, name, rarity, element, image_url, sprite_cutout_url, sprite_url, hp, atk, def, description')
      .eq('rarity', 'comune')
      .eq('spawnable', true)
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
    store.delete('creatures-spawnable')
    store.delete('creatures-starters')
  }
  if (key === 'catch-config') store.delete('global-catch-config')
}
