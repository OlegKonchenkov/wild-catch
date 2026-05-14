import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

const PINS = [
  { id: 'pin-1', lat: 45.0, lng: 13.0, name: 'Bar', description: 'Test', image_url: null, reward_type: 'oggetto', reward_radius_m: 50, reward_payload: { item_id: 'item-1' }, enigma_id: null },
  { id: 'pin-2', lat: 45.1, lng: 13.1, name: 'Piazza', description: null, image_url: null, reward_type: 'boss', reward_radius_m: 50, reward_payload: { creatures: [] }, enigma_id: null },
]

function buildMock({
  pins = PINS,
  claimedPinIds = [] as string[],
  wonBossPinIds = [] as string[],
}: any = {}) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'session_map_pins') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: pins })),
          })),
        })),
      }
      if (table === 'pin_claims') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({ data: claimedPinIds.map(pin_id => ({ pin_id })) })),
          })),
        })),
      }
      if (table === 'boss_fights') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            in: vi.fn(async () => ({ data: wonBossPinIds.map(pin_id => ({ pin_id })) })),
          })) })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

function makeRequest(url: string) {
  return new Request(url, { method: 'GET' })
}

describe('GET /api/game/map-pins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    expect(res.status).toBe(401)
  })

  it('400 when sessionId is missing', async () => {
    const res = await GET(makeRequest('http://x'))
    expect(res.status).toBe(400)
  })

  it('returns pins with claimed=false when player has not claimed any', async () => {
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pins).toHaveLength(2)
    expect(body.pins[0].id).toBe('pin-1')
    expect(body.pins[0].claimed).toBe(false)
    expect(body.pins[1].claimed).toBe(false)
  })

  it('marks oggetto pin as claimed when pin_claims row exists', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({ claimedPinIds: ['pin-1'] }) as any)
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    const body = await res.json()
    expect(body.pins.find((p: any) => p.id === 'pin-1').claimed).toBe(true)
    expect(body.pins.find((p: any) => p.id === 'pin-2').claimed).toBe(false)
  })

  it('marks boss pin as claimed only when boss_fight status=won', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({ wonBossPinIds: ['pin-2'] }) as any)
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    const body = await res.json()
    expect(body.pins.find((p: any) => p.id === 'pin-2').claimed).toBe(true)
  })

  it('strips reward_payload from oggetto pins (contains secrets)', async () => {
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    const body = await res.json()
    // Oggetto pins have inline payload — should be removed in response
    expect(body.pins[0].reward_payload).toBeUndefined()
  })
})
