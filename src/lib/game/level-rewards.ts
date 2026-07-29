import { stackInventory } from '@/lib/game/rewards/inventory'

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = any

/** What a single level actually paid out, for the client to display. */
export interface LevelRewardGrant {
  level: number
  gold: number
  description: string
  items: Array<{ itemId: string; quantity: number; itemName: string | null }>
}

/**
 * Level-up payload handed back to the client. `goldReward` is the flat gold the
 * increment_player_stats RPC grants on level-up (migration 052); `rewards` is
 * whatever the organiser configured in `level_rewards` for the levels crossed.
 */
export interface LevelUpResult {
  newLevel: number
  goldReward: number
  rewards: LevelRewardGrant[]
}

interface BonusItem {
  item_id?: string
  itemId?: string
  quantity?: number
}

function parseBonusItems(raw: unknown, fallbackId: string | null, fallbackQty: number): BonusItem[] {
  const list = Array.isArray(raw) ? (raw as BonusItem[]) : []
  const cleaned = list.filter(bi => bi && (bi.item_id ?? bi.itemId))
  if (cleaned.length > 0) return cleaned
  // Rows authored before `bonus_items` existed only have item_id/item_qty.
  return fallbackId ? [{ item_id: fallbackId, quantity: fallbackQty }] : []
}

/**
 * Pay out every configured `level_rewards` entry the player has earned up to
 * `newLevel` and not yet received, and return what was granted.
 *
 * Why "up to newLevel" and not "for newLevel":
 *   - a single XP award can cross more than one level, and the RPC only
 *     reports the final `new_level` — reading it literally would silently drop
 *     the intermediate levels' rewards;
 *   - players who levelled up before this delivery code existed have unpaid
 *     levels behind them; this back-fills them on the next level-up instead of
 *     writing those rewards off.
 *
 * Delivery is at-most-once: the ledger row is claimed FIRST (unique constraint
 * on user+session+level, `ignoreDuplicates` so a concurrent grant loses the
 * race cleanly) and only the levels we actually claimed are then dispensed. A
 * crash between claim and dispense loses a reward rather than duplicating it,
 * which is the right way round for a currency.
 *
 * Never throws: a failure here must not take down the catch/duel/boss response
 * that triggered the level-up.
 */
export async function grantLevelRewards(
  client: SupabaseLike,
  userId: string,
  sessionId: string,
  newLevel: number,
): Promise<LevelRewardGrant[]> {
  try {
    if (!Number.isFinite(newLevel) || newLevel < 1) return []

    const { data: configured } = await client
      .from('level_rewards')
      .select('level, gold, description, bonus_items, item_id, item_qty')
      .lte('level', newLevel)
      .order('level')

    const rows = (configured ?? []) as Array<{
      level: number
      gold: number | null
      description: string | null
      bonus_items: unknown
      item_id: string | null
      item_qty: number | null
    }>
    if (rows.length === 0) return []

    // Claim before granting.
    const { data: claimed } = await client
      .from('player_level_rewards')
      .upsert(
        rows.map(r => ({ user_id: userId, session_id: sessionId, level: r.level })),
        { onConflict: 'user_id,session_id,level', ignoreDuplicates: true },
      )
      .select('level')

    const claimedLevels = new Set<number>(
      ((claimed ?? []) as Array<{ level: number }>).map(r => r.level),
    )
    if (claimedLevels.size === 0) return []

    const granted: LevelRewardGrant[] = []

    for (const row of rows) {
      if (!claimedLevels.has(row.level)) continue

      const gold = Number(row.gold) || 0
      const grant: LevelRewardGrant = {
        level: row.level,
        gold,
        description: row.description ?? '',
        items: [],
      }

      if (gold > 0) {
        // Same atomic RPC dispenseReward uses for its 'gold' case. Called
        // directly rather than through dispenseReward because level rewards are
        // triggered FROM the exp path inside that module — going back through
        // it would close an import cycle.
        await client.rpc('increment_player_stats', {
          p_user_id: userId,
          p_session_id: sessionId,
          p_exp: 0,
          p_score: 0,
          p_gold: gold,
          p_gemme: 0,
        })
      }

      for (const bonus of parseBonusItems(row.bonus_items, row.item_id, Number(row.item_qty) || 1)) {
        const itemId = bonus.item_id ?? bonus.itemId
        if (!itemId) continue
        const quantity = Number(bonus.quantity) || 1
        await stackInventory(client, userId, sessionId, itemId, quantity)
        const { data: item } = await client.from('items').select('name').eq('id', itemId).single()
        grant.items.push({ itemId, quantity, itemName: (item as any)?.name ?? null })
      }

      if (grant.gold > 0 || grant.items.length > 0 || grant.description) granted.push(grant)
    }

    return granted
  } catch {
    return []
  }
}
