import type { SupabaseClient } from '@supabase/supabase-js'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Upsert-style stack of an item into player_inventory (insert, or add to the
 * existing quantity).
 *
 * Lives in its own module rather than inside dispense.ts so that other reward
 * paths — level-rewards.ts in particular — can grant items without importing
 * dispense.ts and creating an import cycle.
 */
export async function stackInventory(
  client: SupabaseClient,
  userId: string,
  sessionId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const { data: existing } = await client
    .from('player_inventory')
    .select('id, quantity')
    .eq('user_id', userId).eq('session_id', sessionId).eq('item_id', itemId)
    .maybeSingle()
  if (existing) {
    await client.from('player_inventory')
      .update({ quantity: (existing as any).quantity + quantity })
      .eq('id', (existing as any).id)
  } else {
    await client.from('player_inventory').insert({
      user_id: userId, session_id: sessionId, item_id: itemId, quantity,
    })
  }
}
