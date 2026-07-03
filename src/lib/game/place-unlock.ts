import type { SupabaseClient } from '@supabase/supabase-js'
import { dispenseReward, type RewardType, type DispenseResult } from '@/lib/game/rewards/dispense'

export interface PlaceUnlockResult {
  placeId: string
  placeName: string
  drops: DispenseResult[]
}

/**
 * Guardiano del luogo: se il pin appena vinto custodisce un luogo culturale
 * (session_map_pins.place_id) e il giocatore non l'ha ancora liberato in questa
 * sessione, registra lo sblocco ed eroga l'unlock_bonus del luogo via dispenser.
 *
 * Idempotente: UNIQUE(user, session, place) + check preliminare; una rivincita
 * sullo stesso guardiano non riconsegna il bonus. Ritorna null se il pin non
 * custodisce nulla o il luogo era già liberato.
 */
export async function unlockPlaceIfGuardian(
  admin: SupabaseClient,
  userId: string,
  sessionId: string,
  pinId: string,
): Promise<PlaceUnlockResult | null> {
  const { data: pin } = await admin
    .from('session_map_pins')
    .select('place_id')
    .eq('id', pinId)
    .maybeSingle()
  const placeId = (pin as { place_id?: string | null } | null)?.place_id
  if (!placeId) return null

  const { data: existing } = await admin
    .from('player_place_unlocks')
    .select('id')
    .eq('user_id', userId).eq('session_id', sessionId).eq('place_id', placeId)
    .maybeSingle()
  if (existing) return null

  const { error: insErr } = await admin.from('player_place_unlocks').insert({
    user_id: userId, session_id: sessionId, place_id: placeId,
  })
  // Corsa concorrente: l'altro win ha già sbloccato (e dispensato). Non duplicare.
  if (insErr) return null

  const { data: place } = await admin
    .from('cultural_places')
    .select('name, unlock_bonus')
    .eq('id', placeId)
    .single()
  const placeName = (place as { name?: string } | null)?.name ?? 'Luogo'

  const bonus = (place as { unlock_bonus?: unknown } | null)?.unlock_bonus
  const drops: DispenseResult[] = []
  if (Array.isArray(bonus)) {
    for (const entry of bonus as Array<{ type: string; payload?: Record<string, any> }>) {
      if (!entry?.type) continue
      drops.push(await dispenseReward(admin, {
        userId, sessionId, type: entry.type as RewardType, payload: entry.payload ?? {},
      }))
    }
  }

  admin.from('player_game_events').insert({
    user_id: userId, session_id: sessionId, type: 'place_unlocked',
    payload: { place_name: placeName, drop_count: drops.length },
  }).then(undefined, () => {})

  return { placeId, placeName, drops: drops.filter(d => d.ok) }
}
