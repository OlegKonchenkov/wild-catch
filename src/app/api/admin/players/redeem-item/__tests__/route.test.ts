import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { POST } from '../route'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTotalExpForLevel, MAX_PLAYER_LEVEL } from '@/lib/game/leveling'

interface RedeemItemState {
  inventoryQuantity: number
  rewardExp: number
  rewardGold?: number
  exp: number
  level: number
  playerSessionUpdates: Array<Record<string, unknown>>
  inventoryUpdates: Array<Record<string, unknown>>
  deletedInventoryIds: string[]
  notificationPayload: Record<string, unknown> | null
}

function createAdminMock(state: RedeemItemState) {
  return {
    from(table: string) {
      if (table === 'sessions') {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({ data: { status: 'active' } }),
                }
              },
            }
          },
        }
      }

      if (table === 'player_inventory') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          single: async () => ({
                            data: {
                              id: 'inv-1',
                              quantity: state.inventoryQuantity,
                              item_id: 'item-1',
                              items: {
                                id: 'item-1',
                                name: 'Pergamena EXP',
                                is_redeemable: true,
                                reward: {
                                  exp: state.rewardExp,
                                  gold: state.rewardGold ?? 0,
                                },
                              },
                            },
                          }),
                        }
                      },
                    }
                  },
                }
              },
            }
          },
          update(payload: Record<string, unknown>) {
            state.inventoryUpdates.push(payload)
            return {
              eq: async () => ({ error: null }),
            }
          },
          delete() {
            return {
              eq: async (_column: string, id: string) => {
                state.deletedInventoryIds.push(id)
                return { error: null }
              },
            }
          },
          insert: vi.fn(async () => ({ error: null })),
        }
      }

      if (table === 'player_sessions') {
        return {
          select(columns: string) {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      single: async () => {
                        if (columns.includes('gold') && !columns.includes('exp')) {
                          return { data: { gold: 0 } }
                        }

                        return {
                          data: {
                            exp: state.exp,
                            level: state.level,
                          },
                        }
                      },
                    }
                  },
                }
              },
            }
          },
          update(payload: Record<string, unknown>) {
            state.playerSessionUpdates.push(payload)
            return {
              eq() {
                return {
                  eq: async () => ({ error: null }),
                }
              },
            }
          },
        }
      }

      if (table === 'player_notifications') {
        return {
          insert(payload: Record<string, unknown>) {
            state.notificationPayload = payload
            return Promise.resolve({ error: null })
          },
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }
}

describe('POST /api/admin/players/redeem-item', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })),
      },
      rpc: vi.fn(async (fn: string) => ({ data: fn === 'is_admin' })),
    } as any)
  })

  it('uses the shared EXP curve for the level 19 to 20 transition', async () => {
    const state: RedeemItemState = {
      inventoryQuantity: 2,
      rewardExp: 430,
      exp: getTotalExpForLevel(20) - 430,
      level: 19,
      playerSessionUpdates: [],
      inventoryUpdates: [],
      deletedInventoryIds: [],
      notificationPayload: null,
    }

    vi.mocked(createAdminClient).mockReturnValue(createAdminMock(state) as any)

    const res = await POST(new Request('http://localhost/api/admin/players/redeem-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', sessionId: 'session-1', inventoryId: 'inv-1' }),
    }))

    expect(res.status).toBe(200)
    expect(state.inventoryUpdates).toContainEqual({ quantity: 1 })
    expect(state.playerSessionUpdates).toContainEqual({
      exp: getTotalExpForLevel(20),
      level: 20,
    })
    expect(state.notificationPayload).toMatchObject({
      type: 'item_redeemed',
      payload: {
        item_name: 'Pergamena EXP',
      },
    })
  })

  it('never levels beyond 99 even if more EXP is redeemed', async () => {
    const state: RedeemItemState = {
      inventoryQuantity: 1,
      rewardExp: 5000,
      exp: getTotalExpForLevel(MAX_PLAYER_LEVEL),
      level: MAX_PLAYER_LEVEL,
      playerSessionUpdates: [],
      inventoryUpdates: [],
      deletedInventoryIds: [],
      notificationPayload: null,
    }

    vi.mocked(createAdminClient).mockReturnValue(createAdminMock(state) as any)

    const res = await POST(new Request('http://localhost/api/admin/players/redeem-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', sessionId: 'session-1', inventoryId: 'inv-1' }),
    }))

    expect(res.status).toBe(200)
    expect(state.deletedInventoryIds).toEqual(['inv-1'])
    expect(state.playerSessionUpdates).toContainEqual({
      exp: getTotalExpForLevel(MAX_PLAYER_LEVEL) + 5000,
      level: MAX_PLAYER_LEVEL,
    })
  })
})
