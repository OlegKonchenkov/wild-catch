import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/logSessionError', () => ({ logSessionError: vi.fn(async () => {}) }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

const ESCA_ITEM = { id: 'inv-1', quantity: 2, items: { id: 'item-1', name: 'Esca base', type: 'esca', effect_value: 0, description: '' } }
const UOVO_ITEM = { id: 'inv-2', quantity: 1, items: { id: 'item-2', name: 'Uovo comune', type: 'uovo', effect_value: 500, description: '' } }

function buildMock({
  sessionStatus = 'active',
  invItem = ESCA_ITEM,
} = {}) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { status: sessionStatus } })) })),
        })),
      }
      if (table === 'player_inventory') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: invItem })),
          })) })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { steps_walked: 0 } })),
          })) })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        })),
      }
      if (table === 'player_eggs') return {
        insert: vi.fn(async () => ({ error: null })),
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })),
      }
    }),
  }
}

describe('POST /api/game/item/use', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ inventoryId: 'inv-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when required fields are missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(400)
  })

  it('403 when session is not active (ended)', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({ sessionStatus: 'ended' }) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ inventoryId: 'inv-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(403)
  })

  it('200 used:true with esca item — activatedUntil is returned', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ inventoryId: 'inv-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.used).toBe(true)
    expect(body.type).toBe('esca')
    expect(typeof body.activatedUntil).toBe('string')
  })

  it('200 used:true with uovo item — incubating:true', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({ invItem: UOVO_ITEM }) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ inventoryId: 'inv-2', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.used).toBe(true)
    expect(body.type).toBe('uovo')
    expect(body.incubating).toBe(true)
    expect(body.stepsRequired).toBe(500)
  })
})
