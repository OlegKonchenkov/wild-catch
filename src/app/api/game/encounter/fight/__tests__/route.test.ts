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
  abilityRow = null,
  knownRow = null,
}: {
  encounterOverrides?: EncounterOverrides
  playerCreatureOverrides?: EncounterOverrides
  abilityRow?: Record<string, unknown> | null
  knownRow?: Record<string, unknown> | null
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

      if (table === 'abilities') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: abilityRow })),
            })),
          })),
        }
      }

      if (table === 'creature_abilities') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: knownRow })),
              })),
            })),
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

  it('casts a special ability: hits harder than the base attack and persists cooldown state', async () => {
    // 0.9 for every roll → never misses (accuracy 1), never crits.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9)

    const ability = {
      id: 'ab-fire', name: 'Zanna Ardente', description: '', element: 'fiamma', category: 'attacco', rarity: 'comune',
      power: 2, accuracy: 1, target: 'enemy', priority: 0, charge_turns: 0, recharge_turns: 0, cooldown: 2, max_uses: null,
      hits_min: 1, hits_max: 1, status_effect: null, status_chance: 0, self_status: null,
      heal_percent: 0, lifesteal_percent: 0, buff_atk: 0, buff_def: 0, debuff_atk: 0, debuff_def: 0,
      min_level: 1, min_rarity: null, allowed_elements: null, icon_url: null, animation_key: 'fire_slash', sound_url: null, color: null,
    }

    const { client, encounterUpdate } = buildSupabaseMock({
      abilityRow: ability,
      knownRow: { ability_id: 'ab-fire' },
    })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: 'enc-1', abilityId: 'ab-fire', currentPlayerHp: 60 }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.abilityUsed).toEqual({ id: 'ab-fire', name: 'Zanna Ardente' })
    expect(body.abilityCharging).toBe(false)
    // Base attack is a mocked flat 10; the power-2 ability must exceed that.
    expect(body.playerDamage).toBeGreaterThan(10)
    // Cooldown state is persisted so the move can't be spammed next turn.
    const updateArg = (encounterUpdate.mock.calls[0] as unknown as any[])[0]
    expect(updateArg.ability_state.player.cooldowns['ab-fire']).toBe(2)

    randomSpy.mockRestore()
  })

  it('a charging ability deals no damage on the first turn and stores the pending move', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9)

    const ability = {
      id: 'ab-beam', name: 'Esplosione Solare', description: '', element: 'fiamma', category: 'attacco', rarity: 'raro',
      power: 3, accuracy: 1, target: 'enemy', priority: 0, charge_turns: 1, recharge_turns: 0, cooldown: 0, max_uses: null,
      hits_min: 1, hits_max: 1, status_effect: null, status_chance: 0, self_status: null,
      heal_percent: 0, lifesteal_percent: 0, buff_atk: 0, buff_def: 0, debuff_atk: 0, debuff_def: 0,
      min_level: 1, min_rarity: null, allowed_elements: null, icon_url: null, animation_key: 'charge_beam', sound_url: null, color: null,
    }

    const { client, encounterUpdate } = buildSupabaseMock({
      abilityRow: ability,
      knownRow: { ability_id: 'ab-beam' },
    })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: 'enc-1', abilityId: 'ab-beam', currentPlayerHp: 60 }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.abilityCharging).toBe(true)
    expect(body.playerDamage).toBe(0)
    const updateArg = (encounterUpdate.mock.calls[0] as unknown as any[])[0]
    expect(updateArg.ability_state.player.pending.abilityId).toBe('ab-beam')

    randomSpy.mockRestore()
  })
})
