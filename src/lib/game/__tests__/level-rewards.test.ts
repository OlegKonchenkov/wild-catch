import { beforeEach, describe, expect, it, vi } from 'vitest'
import { grantLevelRewards } from '@/lib/game/level-rewards'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Configured {
  level: number
  gold?: number
  description?: string
  bonus_items?: Array<{ item_id: string; quantity: number }>
  item_id?: string | null
  item_qty?: number
}

/**
 * Minimal Supabase stub. `alreadyGranted` models rows that exist in the ledger:
 * the upsert with ignoreDuplicates only returns the levels it actually claimed.
 */
function makeClient(configured: Configured[], alreadyGranted: number[] = []) {
  const rpc = vi.fn(async () => ({ data: [{}], error: null }))
  const inventoryInserts: Array<{ itemId: string; quantity: number }> = []
  const claimedPayloads: any[] = []

  const client: any = {
    rpc,
    from: (table: string) => {
      if (table === 'level_rewards') {
        const chain: any = {}
        chain.select = () => chain
        chain.lte = (_col: string, max: number) => {
          chain._max = max
          return chain
        }
        chain.order = async () => ({
          data: configured
            .filter(c => c.level <= chain._max)
            .map(c => ({
              level: c.level,
              gold: c.gold ?? 0,
              description: c.description ?? '',
              bonus_items: c.bonus_items ?? [],
              item_id: c.item_id ?? null,
              item_qty: c.item_qty ?? 1,
            })),
        })
        return chain
      }
      if (table === 'player_level_rewards') {
        return {
          upsert: (rows: any[]) => {
            claimedPayloads.push(rows)
            return {
              select: async () => ({
                data: rows.filter(r => !alreadyGranted.includes(r.level)).map(r => ({ level: r.level })),
              }),
            }
          },
        }
      }
      if (table === 'player_inventory') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
          }),
          insert: async (row: any) => {
            inventoryInserts.push({ itemId: row.item_id, quantity: row.quantity })
            return {}
          },
        }
      }
      if (table === 'items') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { name: 'Rete Robusta' } }) }) }),
        }
      }
      return { select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }
    },
  }

  return { client, rpc, inventoryInserts, claimedPayloads }
}

describe('grantLevelRewards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns nothing when no level rewards are configured', async () => {
    const { client, rpc } = makeClient([])
    expect(await grantLevelRewards(client, 'u1', 's1', 5)).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('grants the configured gold for a reached level', async () => {
    const { client, rpc } = makeClient([{ level: 3, gold: 200, description: 'Ben fatto!' }])
    const granted = await grantLevelRewards(client, 'u1', 's1', 3)

    expect(granted).toEqual([
      { level: 3, gold: 200, description: 'Ben fatto!', items: [] },
    ])
    expect(rpc).toHaveBeenCalledWith('increment_player_stats', expect.objectContaining({
      p_user_id: 'u1', p_session_id: 's1', p_gold: 200, p_exp: 0,
    }))
  })

  it('grants bonus items and reports their names', async () => {
    const { client, inventoryInserts } = makeClient([
      { level: 2, bonus_items: [{ item_id: 'it-1', quantity: 3 }] },
    ])
    const granted = await grantLevelRewards(client, 'u1', 's1', 2)

    expect(inventoryInserts).toEqual([{ itemId: 'it-1', quantity: 3 }])
    expect(granted[0].items).toEqual([
      { itemId: 'it-1', quantity: 3, itemName: 'Rete Robusta' },
    ])
  })

  it('falls back to the legacy item_id/item_qty columns', async () => {
    const { client, inventoryInserts } = makeClient([
      { level: 2, bonus_items: [], item_id: 'legacy-1', item_qty: 2 },
    ])
    await grantLevelRewards(client, 'u1', 's1', 2)
    expect(inventoryInserts).toEqual([{ itemId: 'legacy-1', quantity: 2 }])
  })

  // A single XP award can cross more than one level, and the RPC only reports
  // the final new_level — paying only that level would silently drop the rest.
  it('pays every level crossed, not just the last one', async () => {
    const { client } = makeClient([
      { level: 2, gold: 50 },
      { level: 3, gold: 75 },
      { level: 4, gold: 100 },
    ])
    const granted = await grantLevelRewards(client, 'u1', 's1', 4)
    expect(granted.map(g => g.level)).toEqual([2, 3, 4])
  })

  it('ignores levels above the one reached', async () => {
    const { client } = makeClient([
      { level: 2, gold: 50 },
      { level: 9, gold: 999 },
    ])
    const granted = await grantLevelRewards(client, 'u1', 's1', 3)
    expect(granted.map(g => g.level)).toEqual([2])
  })

  // The ledger is what makes this at-most-once: a level already paid out must
  // not pay again on the next level-up, however many times it's re-checked.
  it('does not re-pay a level already in the ledger', async () => {
    const { client, rpc } = makeClient(
      [{ level: 2, gold: 50 }, { level: 3, gold: 75 }],
      [2],
    )
    const granted = await grantLevelRewards(client, 'u1', 's1', 3)

    expect(granted.map(g => g.level)).toEqual([3])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('increment_player_stats', expect.objectContaining({ p_gold: 75 }))
  })

  it('claims the ledger row before granting anything', async () => {
    const { client, claimedPayloads } = makeClient([{ level: 2, gold: 50 }])
    await grantLevelRewards(client, 'u1', 's1', 2)
    expect(claimedPayloads[0]).toEqual([{ user_id: 'u1', session_id: 's1', level: 2 }])
  })

  it('returns [] instead of throwing when the query blows up', async () => {
    const broken: any = { from: () => { throw new Error('db down') } }
    expect(await grantLevelRewards(broken, 'u1', 's1', 3)).toEqual([])
  })

  it('ignores a nonsensical level', async () => {
    const { client } = makeClient([{ level: 1, gold: 10 }])
    expect(await grantLevelRewards(client, 'u1', 's1', 0)).toEqual([])
    expect(await grantLevelRewards(client, 'u1', 's1', NaN)).toEqual([])
  })
})
