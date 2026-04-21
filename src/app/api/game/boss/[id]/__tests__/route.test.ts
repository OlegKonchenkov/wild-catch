import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/game/elements', () => ({
  getElementMultiplier: vi.fn(() => 1),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function buildBossRouteMocks({
  fight,
  hydratedBoss,
}: {
  fight: Record<string, any>
  hydratedBoss?: { status_effect: string | null; status_effect_chance: number | null }
}) {
  const bossFightUpdates: Array<Record<string, unknown>> = []
  const creatureHydration = vi.fn(async () => ({
    data: hydratedBoss
      ? [{
          id: (fight.boss_lineup as Array<Record<string, unknown>>)[0]?.creature_id,
          status_effect: hydratedBoss.status_effect,
          status_effect_chance: hydratedBoss.status_effect_chance,
        }]
      : [],
  }))

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'boss_fights') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: clone(fight) })),
              })),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            bossFightUpdates.push(payload)
            return {
              eq: vi.fn(async () => ({ error: null })),
            }
          }),
        }
      }

      throw new Error(`Unexpected client table: ${table}`)
    }),
  }

  const adminClient = {
    from: vi.fn((table: string) => {
      if (table === 'creatures') {
        return {
          select: vi.fn(() => ({
            in: creatureHydration,
          })),
        }
      }

      if (table === 'player_game_events') {
        return {
          insert: vi.fn(() => Promise.resolve({ error: null })),
        }
      }

      if (table === 'boss_fights') {
        return {
          update: vi.fn((payload: Record<string, unknown>) => {
            bossFightUpdates.push(payload)
            return {
              eq: vi.fn(async () => ({ error: null })),
            }
          }),
        }
      }

      throw new Error(`Unexpected admin table: ${table}`)
    }),
  }

  return { client, adminClient, bossFightUpdates, creatureHydration }
}

describe('POST /api/game/boss/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hydrates legacy boss lineups and applies the boss status effect on the counterattack', async () => {
    const fight = {
      id: 'fight-1',
      user_id: 'user-1',
      session_id: 'session-1',
      status: 'active',
      boss_active_slot: 0,
      player_active_slot: 0,
      reward: null,
      boss_lineup: [
        {
          slot: 0,
          creature_id: 'boss-1',
          name: 'Boss',
          element: 'bosco',
          level: 1,
          atk: 18,
          def: 6,
          max_hp: 70,
          current_hp: 70,
          fainted: false,
          image_url: '',
          sprite_url: '',
        },
      ],
      player_lineup: [
        {
          slot: 0,
          player_creature_id: 'pc-1',
          name: 'Hero',
          element: 'fiamma',
          rarity: 'comune',
          level: 1,
          atk: 16,
          def: 8,
          max_hp: 60,
          current_hp: 60,
          fainted: false,
          is_active: true,
          image_url: '',
          status_effect: null,
          status_effect_chance: 0,
          active_status: null,
          status_turns_left: 0,
        },
      ],
    }

    const { client, adminClient, bossFightUpdates, creatureHydration } = buildBossRouteMocks({
      fight,
      hydratedBoss: { status_effect: 'sonno', status_effect_chance: 1 },
    })

    vi.mocked(createClient).mockResolvedValue(client as any)
    vi.mocked(createAdminClient).mockReturnValue(adminClient as any)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9)

    const res = await POST(
      new Request('http://localhost/api/game/boss/fight-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attack' }),
      }),
      { params: Promise.resolve({ id: 'fight-1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(creatureHydration).toHaveBeenCalledTimes(1)
    expect(body.statusAppliedToPlayer).toBe('sonno')
    expect(body.playerStatusTurnsLeft).toBe(2)
    expect(bossFightUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        boss_lineup: expect.arrayContaining([
          expect.objectContaining({
            status_effect: 'sonno',
            status_effect_chance: 1,
          }),
        ]),
      }),
    ]))

    randomSpy.mockRestore()
  })

  it('uses confusion self-hit for the player instead of treating it like a skipped turn', async () => {
    const fight = {
      id: 'fight-2',
      user_id: 'user-1',
      session_id: 'session-1',
      status: 'active',
      boss_active_slot: 0,
      player_active_slot: 0,
      reward: null,
      boss_lineup: [
        {
          slot: 0,
          creature_id: 'boss-1',
          name: 'Boss',
          element: 'bosco',
          level: 1,
          atk: 14,
          def: 5,
          max_hp: 70,
          current_hp: 70,
          fainted: false,
          image_url: '',
          sprite_url: '',
          status_effect: null,
          status_effect_chance: 0,
          active_status: null,
          status_turns_left: 0,
        },
      ],
      player_lineup: [
        {
          slot: 0,
          player_creature_id: 'pc-1',
          name: 'Hero',
          element: 'fiamma',
          rarity: 'comune',
          level: 1,
          atk: 20,
          def: 10,
          max_hp: 72,
          current_hp: 72,
          fainted: false,
          is_active: true,
          image_url: '',
          status_effect: null,
          status_effect_chance: 0,
          active_status: 'confusione',
          status_turns_left: 3,
        },
      ],
    }

    const { client, adminClient } = buildBossRouteMocks({ fight })

    vi.mocked(createClient).mockResolvedValue(client as any)
    vi.mocked(createAdminClient).mockReturnValue(adminClient as any)
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.2)
      .mockReturnValue(0.9)

    const res = await POST(
      new Request('http://localhost/api/game/boss/fight-2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attack' }),
      }),
      { params: Promise.resolve({ id: 'fight-2' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.playerDamage).toBe(0)
    expect(body.preTurnStatusEvent).toEqual(expect.objectContaining({
      type: 'confusione',
      selfHit: true,
    }))
    expect(body.playerHpBeforeBossAttack).toBeLessThan(72)

    randomSpy.mockRestore()
  })
})
