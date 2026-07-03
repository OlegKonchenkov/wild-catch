import type { SupabaseClient } from '@supabase/supabase-js'
import { dispenseReward } from '@/lib/game/rewards/dispense'
import { gymAccruedGold } from '@/lib/game/gym'
import { sendPushToUser } from '@/lib/push'

export interface GymVictoryResult {
  taken: boolean
  dethroned: { holderId: string; accruedGold: number } | null
}

/**
 * Vittoria su un pin palestra (payload.gym): il vincitore diventa il nuovo
 * titolare; lo spodestato incassa la rendita maturata (10 oro/h, cap 240) e
 * riceve una push. Idempotente rispetto al titolare corrente: se il vincitore
 * presidia già (non dovrebbe accadere — il claim lo blocca), non tocca nulla.
 */
export async function handleGymVictory(
  admin: SupabaseClient,
  winnerId: string,
  sessionId: string,
  pinId: string,
): Promise<GymVictoryResult | null> {
  // È davvero una palestra?
  const { data: pin } = await admin
    .from('session_map_pins')
    .select('reward_payload, name')
    .eq('id', pinId)
    .maybeSingle()
  const payload = (pin as { reward_payload?: { gym?: boolean } | null } | null)?.reward_payload
  if (!payload || payload.gym !== true) return null

  const { data: hold } = await admin
    .from('gym_holds')
    .select('id, holder_id, held_since')
    .eq('pin_id', pinId).eq('session_id', sessionId)
    .maybeSingle()
  const current = hold as { id: string; holder_id: string; held_since: string } | null

  if (current?.holder_id === winnerId) return { taken: false, dethroned: null }

  const now = new Date().toISOString()
  if (current) {
    await admin.from('gym_holds')
      .update({ holder_id: winnerId, held_since: now })
      .eq('id', current.id)
  } else {
    const { error } = await admin.from('gym_holds').insert({
      pin_id: pinId, session_id: sessionId, holder_id: winnerId, held_since: now,
    })
    // Corsa: qualcun altro ha appena preso la palestra — la conquista vale comunque
    // come vittoria boss, ma il presidio è suo.
    if (error) return { taken: false, dethroned: null }
  }

  let dethroned: GymVictoryResult['dethroned'] = null
  if (current) {
    const accruedGold = gymAccruedGold(current.held_since)
    if (accruedGold > 0) {
      await dispenseReward(admin, {
        userId: current.holder_id, sessionId, type: 'gold', payload: { amount: accruedGold },
      })
    }
    dethroned = { holderId: current.holder_id, accruedGold }
    const gymName = (pin as { name?: string } | null)?.name ?? 'la palestra'
    sendPushToUser(current.holder_id, {
      title: '🏰 Ti hanno spodestato!',
      body: accruedGold > 0
        ? `Hai perso ${gymName}, ma il presidio ti ha fruttato ${accruedGold} 🪙. Riconquistala!`
        : `Hai perso ${gymName}. Riconquistala!`,
      url: '/game/map',
      tag: `gym_${pinId}_taken`,
    }).catch(() => {})
  }

  admin.from('player_game_events').insert({
    user_id: winnerId, session_id: sessionId, type: 'gym_taken',
    payload: { pin_name: (pin as { name?: string } | null)?.name ?? '', dethroned: !!current },
  }).then(undefined, () => {})

  return { taken: true, dethroned }
}
