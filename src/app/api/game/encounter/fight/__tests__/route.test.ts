import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/game/rng', () => ({
  calculateFightDamage: vi.fn(() => 10),
  getCatchHealthMultiplier: vi.fn(() => 1),
  rollDice: vi.fn(() => 1),
}))

vi.mock('@/lib/game/elements', () => ({
  getElementMultiplier: vi.fn(() => 1),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

type EncounterOverrides = Partial<Record<string, unknown>>

function buildSupabaseMock({
  encounterOverrides = {},
  playerCreatureOverrides = {},
}: {
  encounterOverrides?: EncounterOverrides
  playerCreatureOverrides?: EncounterOverrides
} = {}) {
  const encounterUpdate = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }))

  const encounter = {
    id: 'enc-1',
    user_id: 'user-1',
    session_id: 'session-1',
    status: 'active',
    wild_creature_hp: 45,
    player_creature_id: 'pc-1',
    wild_status: null,
    wild_status_turns: 0,
    player_status: null,
    player_status_turns: 0,
    creatures: {
      id: 'wild-1',
      hp: 80,
      atk: 18,
      def: 6,
      element: 'bosco',
      rarity: 'comune',
      status_effect: null,
      status_effect_chance: 0,
    },
    sessions: { status: 'active' },
    ...encounterOverrides,
  }

  const playerCreature = {
    id: 'pc-1',
    user_id: 'user-1',
    creatures: {
      hp: 60,
      atk: 16,
      def: 10,
      element: 'fiamma',
      rarity: 'comune',
      status_effect: null,
      status_effect_chance: 0,
    },
    ...playerCreatureOverrides,
  }

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'encounters') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: encounter })),
                })),
              })),
            })),
          })),
          update: encounterUpdate,
        }
      }

      if (table === 'sessions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { status: 'active' } })),
            })),
          })),
        }
      }

      if (table === 'player_creatures') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: playerCreature })),
              })),
            })),
          })),
        }
      }

      if (table === 'player_inventory') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: null })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        }
      }

      throw new Error(`Unexpected table access: ${table}`)
    }),
  }

  return { client, encounterUpdate }
}

describe('POST /api/game/encounter/fight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks the player attack when paralysis rolls inside the 65% skip window', async () => {
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.9)

    const { client, encounterUpdate } = buildSupabaseMock({
      encounterOverrides: {
        player_status: 'paralisi',
        player_status_turns: 2,
      },
    })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: 'enc-1', currentPlayerHp: 40 }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.playerDamage).toBe(0)
    expect(body.statusEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'paralisi', target: 'player', paralysisSkip: true, turnsLeft: 1 }),
    ]))
    expect(encounterUpdate).toHaveBeenCalledWith(expect.objectContaining({
      player_status: 'paralisi',
      player_status_turns: 1,
    }))

    randomSpy.mockRestore()
  })

  it('applies confusion self-hit before the attack and reports the new player hp', async () => {
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.9)

    const { client } = buildSupabaseMock({
      encounterOverrides: {
        player_status: 'confusione',
        player_status_turns: 3,
      },
    })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: 'enc-1', currentPlayerHp: 28 }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.playerDamage).toBe(0)
    expect(body.statusEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'confusione', target: 'player', selfHit: true }),
    ]))
    expect(body.playerHpRemaining).toBeLessThan(28)

    randomSpy.mockRestore()
  })

  it('uses the current player hp for poison instead of pretending the player is always at max hp', async () => {
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.9)

    const { client } = buildSupabaseMock({
      encounterOverrides: {
        player_status: 'veleno',
        player_status_turns: 0,
        wild_status: 'sonno',
        wild_status_turns: 1,
      },
    })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: 'enc-1', currentPlayerHp: 12 }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.statusEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'veleno', target: 'player', poisonDamage: 6, newHp: 6 }),
    ]))
    expect(body.playerHpRemaining).toBe(6)
    expect(body.playerDamage).toBeGreaterThan(0)

    randomSpy.mockRestore()
  })

  it('applies a newly inflicted paralysis on the wild at the start of its immediate counter-turn', async () => {
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.2)

    const { client } = buildSupabaseMock({
      playerCreatureOverrides: {
        creatures: {
          hp: 60,
          atk: 16,
          def: 10,
          element: 'fiamma',
          rarity: 'comune',
          status_effect: 'paralisi',
          status_effect_chance: 1,
        },
      },
    })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: 'enc-1', currentPlayerHp: 40 }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.statusAppliedToWild).toBe('paralisi')
    expect(body.playerTookDamage).toBe(false)
    expect(body.wildDamage).toBe(0)
    expect(body.statusEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'paralisi', target: 'wild', paralysisSkip: true, turnsLeft: 1 }),
    ]))

    randomSpy.mockRestore()
  })

  it('ticks a newly inflicted poison on the wild before the immediate counterattack', async () => {
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.0)

    const { client } = buildSupabaseMock({
      encounterOverrides: {
        wild_creature_hp: 18,
      },
      playerCreatureOverrides: {
        creatures: {
          hp: 60,
          atk: 16,
          def: 10,
          element: 'fiamma',
          rarity: 'comune',
          status_effect: 'veleno',
          status_effect_chance: 1,
        },
      },
    })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: 'enc-1', currentPlayerHp: 40 }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.statusAppliedToWild).toBe('veleno')
    expect(body.fightResult).toBe('fled')
    expect(body.playerTookDamage).toBe(false)
    expect(body.wildHpRemaining).toBe(0)
    expect(body.statusEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'veleno', target: 'wild', poisonDamage: 8, newHp: 0 }),
    ]))

    randomSpy.mockRestore()
  })
})
