import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })),
      insert: vi.fn(() => ({ then: (_: any, __: any) => undefined })),
    })),
  })),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitResponse: vi.fn(),
}))
vi.mock('@/lib/game/missions', () => ({
  incrementMissionProgress: vi.fn(async () => []),
}))
vi.mock('@/lib/game/rng', () => ({
  calculateFightDamage: vi.fn(() => 8),
  getCatchHealthMultiplier: vi.fn(() => 1),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

const CREATURE = { id: 'cr-1', name: 'Fiammare', hp: 80, atk: 15, def: 5, element: 'fiamma', rarity: 'comune', catch_difficulty: 3, image_url: null, sprite_url: null }
const ENCOUNTER = { id: 'enc-1', user_id: 'user-1', session_id: 'sess-1', wild_creature_hp: 40, wild_status: null, wild_status_turns: 0, player_creature_id: 'pc-1', creatures: CREATURE, sessions: { status: 'active' } }

function buildMock() {
  const rpcFn = vi.fn(async () => ({ data: [{ leveled_up: false }], error: null }))
  return {
    auth: { getUser: mockGetUser },
    rpc: rpcFn,
    from: vi.fn((table: string) => {
      if (table === 'encounters') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: ENCOUNTER })),
          })) })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
      if (table === 'sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { status: 'active' } })) })),
        })),
      }
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { level: 5, gold: 100 } })),
          })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })),
      }
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })) })) })),
        })),
        upsert: vi.fn(async () => ({ error: null })),
      }
      if (table === 'player_inventory') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: null })),
          })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
      // Silently ignore unexpected tables (e.g. player_game_events via admin)
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })), insert: vi.fn(async () => ({})) }
    }),
  }
}

describe('POST /api/game/encounter/catch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when encounterId is missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('200 caught:true when Math.random guarantees catch', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001)
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    vi.restoreAllMocks()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.caught).toBe(true)
    expect(body.expGain).toBeGreaterThan(0)
  })

  it('404 when encounter is not found', async () => {
    const mock = buildMock()
    // Override encounters to return null
    ;(mock.from as any).mockImplementation((table: string) => {
      if (table === 'encounters') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: null })),
          })) })) })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    })
    vi.mocked(createClient).mockResolvedValue(mock as any)
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-missing' }),
    }))
    expect(res.status).toBe(404)
  })
})
