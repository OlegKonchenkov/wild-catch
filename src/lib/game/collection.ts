import type { SupabaseClient } from '@supabase/supabase-js'

export type CollectibleKind = 'opera' | 'personaggio' | 'aneddoto'

/**
 * Add a collectible (opera/personaggio/aneddoto) to a player's collection,
 * incrementing `copies` if already owned. Returns whether this was the first
 * copy (used to decide ability unlocks / "new!" UI).
 */
export async function grantCollectible(
  client: SupabaseClient, userId: string, sessionId: string, kind: CollectibleKind, refId: string,
): Promise<{ firstCopy: boolean; copies: number }> {
  const { data: existing } = await client
    .from('player_collection')
    .select('id, copies')
    .eq('user_id', userId).eq('session_id', sessionId).eq('kind', kind).eq('ref_id', refId)
    .maybeSingle()

  if (existing) {
    const copies = (existing as any).copies + 1
    await client.from('player_collection').update({ copies }).eq('id', (existing as any).id)
    return { firstCopy: false, copies }
  }
  await client.from('player_collection').insert({
    user_id: userId, session_id: sessionId, kind, ref_id: refId, copies: 1,
  })
  return { firstCopy: true, copies: 1 }
}

interface TrophyCriteria {
  kind?: CollectibleKind
  complete_all?: boolean
  place_id?: string
}

/**
 * Evaluate every trophy against the player's current collection and award any
 * newly-completed ones. A trophy is earned when the player owns all catalogue
 * entries its criteria points at (a whole category, or everything tied to a
 * place). Returns the trophies newly awarded this call.
 */
export async function checkTrophies(
  client: SupabaseClient, userId: string, sessionId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data: trophies } = await client.from('trophies').select('id, name, criteria')
  if (!trophies || trophies.length === 0) return []

  // Already-awarded trophy ids for this player/session
  const { data: awarded } = await client
    .from('player_trophies').select('trophy_id')
    .eq('user_id', userId).eq('session_id', sessionId)
  const awardedIds = new Set((awarded ?? []).map((r: any) => r.trophy_id))

  // Player's owned collectible ref_ids grouped by kind
  const { data: owned } = await client
    .from('player_collection').select('kind, ref_id')
    .eq('user_id', userId).eq('session_id', sessionId)
  const ownedByKind: Record<string, Set<string>> = { opera: new Set(), personaggio: new Set(), aneddoto: new Set() }
  for (const row of owned ?? []) ownedByKind[(row as any).kind]?.add((row as any).ref_id)

  const newlyAwarded: Array<{ id: string; name: string }> = []

  for (const t of trophies) {
    if (awardedIds.has(t.id)) continue
    const c = (t.criteria ?? {}) as TrophyCriteria
    const complete = await isTrophyComplete(client, c, ownedByKind)
    if (complete) {
      const { error } = await client.from('player_trophies').insert({
        user_id: userId, session_id: sessionId, trophy_id: t.id,
      })
      if (!error) newlyAwarded.push({ id: t.id, name: t.name })
    }
  }
  return newlyAwarded
}

async function isTrophyComplete(
  client: SupabaseClient, c: TrophyCriteria, ownedByKind: Record<string, Set<string>>,
): Promise<boolean> {
  // Place-based: own every opera + personaggio + aneddoto tied to the place.
  if (c.place_id) {
    for (const [kind, table] of [['opera', 'artworks'], ['personaggio', 'characters'], ['aneddoto', 'anecdotes']] as const) {
      const { data: rows } = await client.from(table).select('id').eq('place_id', c.place_id)
      const ids = (rows ?? []).map((r: any) => r.id)
      const ownedSet = ownedByKind[kind]
      if (ids.some(id => !ownedSet.has(id))) return false
    }
    return true
  }

  // Category-based: own every catalogue entry of a kind.
  if (c.kind && c.complete_all) {
    const table = c.kind === 'opera' ? 'artworks' : c.kind === 'personaggio' ? 'characters' : 'anecdotes'
    const { data: rows } = await client.from(table).select('id')
    const ids = (rows ?? []).map((r: any) => r.id)
    if (ids.length === 0) return false
    const ownedSet = ownedByKind[c.kind]
    return ids.every(id => ownedSet.has(id))
  }

  return false
}
