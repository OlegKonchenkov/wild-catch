import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/game/missions', () => ({
  incrementMissionProgress: vi.fn(() => Promise.resolve([])),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

function buildDuelHealMocks() {
  const duelLineupUpdates: Array<Record<string, unknown>> = []
  const duelUpdates: Array<Record<string, unknown>> = []
  const inventoryUpdates: Array<Record<string, unknown>> = []
  const sentPayloads: Array<Record<string, unknown>> = []

  const duel = {
    id: 'duel-1',
    session_id: 'session-1',
    challenger_id: 'user-1',
    opponent_id: 'user-2',
    current_turn: 'challenger',
    status: 'active',
  }

  const lineups = [
    {
      id: 'lineup-1',
      duel_id: 'duel-1',
      user_id: 'user-1',
      slot: 0,
      is_active: true,
      fainted_at: null,
      current_hp: 80,
      active_status: 'confusione',
      status_turns_left: 3,
      player_creature_id: 'pc-1',
      player_creatures: {
        creatures: {
          name: 'Hero',
          element: 'fiamma',
          hp: 80,
          atk: 22,
          def: 12,
          rarity: 'comune',
          image_url: '',
          sprite_url: '',
          status_effect: null,
          status_effect_chance: 0,
        },
      },
    },
    {
      id: 'lineup-2',
      duel_id: 'duel-1',
      user_id: 'user-2',
      slot: 0,
      is_active: true,
      fainted_at: null,
      current_hp: 82,
      active_status: null,
      status_turns_left: 0,
      player_creature_id: 'pc-2',
      player_creatures: {
        creatures: {
          name: 'Rival',
          element: 'bosco',
          hp: 82,
          atk: 18,
          def: 10,
          rarity: 'comune',
          image_url: '',
          sprite_url: '',
          status_effect: null,
          status_effect_chance: 0,
        },
      },
    },
  ]

  const duelSelectQuery = {
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data: duel })),
      })),
    })),
  }

  const sessionSelectQuery = {
    eq: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { status: 'active' } })),
    })),
  }

  const inventorySelectQuery = {
    eq: vi.fn(() => inventorySelectQuery),
    single: vi.fn(async () => ({
      data: {
        id: 'inv-1',
        quantity: 2,
        items: { effect_value: 25, type: 'cura' },
      },
    })),
  }

  const lineupsSelectQuery = {
    eq: vi.fn(() => ({
      order: vi.fn(async () => ({ data: lineups })),
    })),
  }

  const playerSessionsSelectQuery = {
    eq: vi.fn(() => ({
      in: vi.fn(async () => ({
        data: [
          { user_id: 'user-1', level: 1 },
          { user_id: 'user-2', level: 1 },
        ],
      })),
    })),
  }

  const channel = {
    subscribe: vi.fn((callback: () => void) => {
      callback()
      return channel
    }),
    send: vi.fn(async (payload: Record<string, unknown>) => {
      sentPayloads.push(payload)
    }),
  }

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => {}),
    from: vi.fn((table: string) => {
      if (table === 'duels') {
        return {
          select: vi.fn(() => duelSelectQuery),
          update: vi.fn((payload: Record<string, unknown>) => {
            duelUpdates.push(payload)
            return {
              eq: vi.fn(async () => ({ error: null })),
            }
          }),
        }
      }

      if (table === 'sessions') {
        return {
          select: vi.fn(() => sessionSelectQuery),
        }
      }

      if (table === 'player_inventory') {
        return {
          select: vi.fn(() => inventorySelectQuery),
          update: vi.fn((payload: Record<string, unknown>) => {
            inventoryUpdates.push(payload)
            return {
              eq: vi.fn(async () => ({ error: null })),
            }
          }),
        }
      }

      if (table === 'duel_lineups') {
        return {
          select: vi.fn(() => lineupsSelectQuery),
          update: vi.fn((payload: Record<string, unknown>) => {
            duelLineupUpdates.push(payload)
            return {
              eq: vi.fn(async () => ({ error: null })),
            }
          }),
        }
      }

      if (table === 'player_sessions') {
        return {
          select: vi.fn(() => playerSessionsSelectQuery),
        }
      }

      throw new Error(`Unexpected table access: ${table}`)
    }),
  }

  return { client, duelLineupUpdates, duelUpdates, inventoryUpdates, sentPayloads }
}

describe('POST /api/game/duel/action heal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not consume the heal item when confusion self-hit blocks the action', async () => {
    const { client, duelLineupUpdates, duelUpdates, inventoryUpdates, sentPayloads } = buildDuelHealMocks()
    vi.mocked(createClient).mockResolvedValue(client as any)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.2)

    const res = await POST(new Request('http://localhost/api/game/duel/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duelId: 'duel-1', action: 'heal', itemId: 'inv-1' }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.turnPassed).toBe(true)
    expect(body.selfDamage).toBeGreaterThan(0)
    expect(inventoryUpdates).toHaveLength(0)
    expect(duelLineupUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        active_status: 'confusione',
        status_turns_left: 2,
      }),
    ]))
    expect(duelUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ current_turn: 'opponent' }),
    ]))
    expect(sentPayloads).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'duel_action',
        payload: expect.objectContaining({
          action: 'status_tick',
          statusEvent: expect.objectContaining({
            type: 'confusione',
            selfHit: true,
          }),
        }),
      }),
    ]))

    randomSpy.mockRestore()
  })
})
