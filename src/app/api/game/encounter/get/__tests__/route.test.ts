import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

const ENCOUNTER = {
  id: 'enc-1',
  user_id: 'user-1',
  session_id: 'sess-1',
  status: 'active',
  wild_creature_hp: 50,
  creatures: {
    id: 'cr-1', name: 'Fiammare', element: 'fiamma', rarity: 'comune',
    hp: 100, image_url: 'img.png', sprite_url: 'sprite.png', lottie_url: null,
  },
}

const SQUAD_PCS = [{
  id: 'pc-1',
  creatures: { id: 'cr-1', name: 'Fiammare', hp: 100, atk: 30, element: 'fiamma', rarity: 'comune', image_url: 'img.png' },
}]

function buildSupabaseMock({
  encounter = ENCOUNTER as any,
  squadIds = ['pc-1'],
  pcs = SQUAD_PCS,
  soundRows = null,
}: any = {}) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'encounters') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: encounter })),
            })) })),
          })),
        }
      }
      if (table === 'player_sessions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { squad_ids: squadIds } })),
            })) })),
          })),
        }
      }
      if (table === 'player_creatures') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ data: pcs })) })) })),
          })),
        }
      }
      if (table === 'creatures') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: soundRows })),
          })),
        }
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

function makeRequest(url: string) {
  return new Request(url, { method: 'GET' })
}

describe('GET /api/game/encounter/get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeRequest('http://x?id=enc-1'))
    expect(res.status).toBe(401)
  })

  it('400 when id is missing', async () => {
    const res = await GET(makeRequest('http://x'))
    expect(res.status).toBe(400)
  })

  it('404 when encounter not found / not owned', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock({ encounter: null }) as any)
    const res = await GET(makeRequest('http://x?id=enc-1'))
    expect(res.status).toBe(404)
  })

  it('returns encounter + creature + squad on success', async () => {
    const res = await GET(makeRequest('http://x?id=enc-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.encounterId).toBe('enc-1')
    expect(body.creature.id).toBe('cr-1')
    expect(body.wildHp).toBe(50)
    expect(body.wildHpMax).toBe(100)
    expect(body.squadCreatures).toHaveLength(1)
    expect(body.squadCreatures[0].pcId).toBe('pc-1')
  })

  it('empty squad when player has no squad_ids', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock({ squadIds: [] }) as any)
    const res = await GET(makeRequest('http://x?id=enc-1'))
    const body = await res.json()
    expect(body.squadCreatures).toEqual([])
  })
})
