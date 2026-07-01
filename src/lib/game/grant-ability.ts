import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface GrantAbilityResult {
  granted: boolean
  quantity: number
  error?: string
}

/**
 * Grant `qty` copies of an ability token to a player's collection (player_abilities),
 * incrementing an existing row or inserting a new one. Shared by every reward
 * surface (missions, QR, boss, map pins, enigmi, admin grant) so the "you earned
 * an ability" behaviour is identical everywhere.
 *
 * Pass an admin (service-role) client when granting on behalf of a player from a
 * server route; RLS otherwise restricts writes to the acting user's own rows.
 */
export async function grantAbility(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
  abilityId: string,
  qty = 1,
): Promise<GrantAbilityResult> {
  if (!userId || !sessionId || !abilityId) {
    return { granted: false, quantity: 0, error: 'Parametri mancanti' }
  }
  const amount = Math.max(1, Math.round(Number(qty) || 1))

  const { data: existing } = await supabase
    .from('player_abilities')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .eq('ability_id', abilityId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('player_abilities')
      .update({ quantity: existing.quantity + amount })
      .eq('id', existing.id)
    if (error) return { granted: false, quantity: 0, error: error.message }
  } else {
    const { error } = await supabase
      .from('player_abilities')
      .insert({ user_id: userId, session_id: sessionId, ability_id: abilityId, quantity: amount })
    if (error) return { granted: false, quantity: 0, error: error.message }
  }
  return { granted: true, quantity: amount }
}
