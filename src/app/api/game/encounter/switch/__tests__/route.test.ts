import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitResponse: vi.fn(),
}))
vi.mock('@/lib/game/rng', () => ({
  calculateFightDamage: vi.fn(() => 10),
  getCatchHealthMultiplier: vi.fn(() => 1),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

const WILD = { id: 'wild-1', hp: 80, atk: 15, def: 5, element: 'bosco', status_effect: null, status_effect_chance: 0 }
const NEW_PC = { id: 'pc-2', creatures: { id: 'cr-2', hp: 60, atk: 12, def: 8, element: 'fiamma' } }

function buildMock({
  encounter = { id: 'enc-1', user_id: 'user-1', session_id: 'sess-1', wild_creature_hp: 40, wild_status: null, wild_status_turns: 0, creatures: WILD },
  newPc = NEW_PC,
} = {}) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'encounters') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: encounter })),
          })) })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
      if (table === 'sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { status: 'active' } })) })),
        })),
      }
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: newPc })),
          })) })),
        })),
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('POST /api/game/encounter/switch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1', newActivePcId: 'pc-2', currentPlayerHp: 50 }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when required fields are missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    expect(res.status).toBe(400)
  })

  it('400 when switching to a fainted creature (currentPlayerHp <= 0)', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1', newActivePcId: 'pc-2', currentPlayerHp: 0 }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('HP')
  })

  it('200 with valid switch — skipPlayerAttack is true', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1', newActivePcId: 'pc-2', currentPlayerHp: 50 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skipPlayerAttack).toBe(true)
    expect(body.playerDamage).toBe(0)
  })
})
