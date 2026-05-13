import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitResponse: vi.fn(),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

function buildMock({
  encounter = { id: 'enc-1', player_creature_id: 'pc-1', session_id: 'sess-1' },
  invItem = { id: 'inv-1', quantity: 2, items: { id: 'item-1', effect_value: 50, type: 'cura' } },
  playerCreature = { creatures: { hp: 100 } },
} = {}) {
  const updateEq = vi.fn(async () => ({ error: null }))
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'encounters') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: encounter })),
          })) })) })),
        })),
      }
      if (table === 'sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { status: 'active' } })) })),
        })),
      }
      if (table === 'player_inventory') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: invItem })),
          })) })) })),
        })),
        update: vi.fn(() => ({ eq: updateEq })),
      }
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: playerCreature })) })),
        })),
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('POST /api/game/encounter/heal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1', itemId: 'inv-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when encounterId or itemId is missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    expect(res.status).toBe(400)
  })

  it('200 with correct healAmount on valid heal', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1', itemId: 'inv-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.healed).toBe(true)
    expect(body.healAmount).toBe(50)  // 100 * 0.50
    expect(body.maxHp).toBe(100)
  })

  it('400 when inventory item is not a cura type', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({
      invItem: { id: 'inv-1', quantity: 1, items: { id: 'item-1', effect_value: 50, type: 'rete' } },
    }) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1', itemId: 'inv-1' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('cura')
  })
})
