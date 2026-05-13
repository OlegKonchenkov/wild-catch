import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/game/missions', () => ({
  incrementMissionProgress: vi.fn(async () => []),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()

// Pin is 0 m away — always within threshold
const PIN = {
  id: 'pin-1',
  session_id: 'sess-1',
  lat: 45.0,
  lng: 13.0,
  name: 'Test pin',
  reward_type: 'oggetto',
  reward_payload: { item_id: 'item-1', quantity: 1 },
  reward_radius_m: 50,
  enigma_id: null,
  enigma_suggerimento_id: null,
}

function buildSupabaseMock() {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { status: 'active' } })) })),
        })),
      }
      if (table === 'pin_claims') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })) })),
        })),
        insert: vi.fn(async () => ({ error: null })),
      }
      if (table === 'player_inventory') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })) })) })),
        })),
        insert: vi.fn(async () => ({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
      if (table === 'items') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { name: 'Rete base' } })) })),
        })),
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })),
        insert: vi.fn(async () => ({ error: null })),
      }
    }),
  }
}

function buildAdminMock(pinOverride = PIN) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'session_map_pins') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: pinOverride })),
          })) })),
        })),
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })),
        insert: vi.fn(() => ({ then: (_: any, __: any) => undefined })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
    }),
  }
}

describe('POST /api/game/map-pins/claim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ pinId: 'pin-1', sessionId: 'sess-1', lat: 45.0, lng: 13.0 }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when required fields are missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ pinId: 'pin-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(400)
  })

  it('200 with success:true on a valid oggetto claim', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ pinId: 'pin-1', sessionId: 'sess-1', lat: 45.0, lng: 13.0 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.type).toBe('oggetto')
  })

  it('409 when pin is already claimed', async () => {
    const supabaseMock = buildSupabaseMock()
    ;(supabaseMock.from as any).mockImplementation((table: string) => {
      if (table === 'pin_claims') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { id: 'claim-1' } })),
          })) })),
        })),
        insert: vi.fn(async () => ({ error: null })),
      }
      return buildSupabaseMock().from(table)
    })
    vi.mocked(createClient).mockResolvedValue(supabaseMock as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ pinId: 'pin-1', sessionId: 'sess-1', lat: 45.0, lng: 13.0 }),
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.alreadyClaimed).toBe(true)
  })
})
