import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

const EGGS = [
  { id: 'egg-1', egg_rarity: 'comune', steps_required: 0, steps_at_pickup: 0, hatched_at: null, hatched_creature_id: null, created_at: '2026-05-15T10:00:00Z' },
  { id: 'egg-2', egg_rarity: 'raro', steps_required: 500, steps_at_pickup: 100, hatched_at: null, hatched_creature_id: null, created_at: '2026-05-15T11:00:00Z' },
]

function buildSupabaseMock({ eggs = EGGS, stepsWalked = 300 } = {}) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'player_eggs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({ is: vi.fn(() => ({
              order: vi.fn(async () => ({ data: eggs })),
            })) })) })),
          })),
        }
      }
      if (table === 'player_sessions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { steps_walked: stepsWalked } })),
            })) })),
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

describe('GET /api/game/eggs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
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

  it('returns eggs with progress + can_hatch flags', async () => {
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eggs).toHaveLength(2)
    // Egg 1: steps_required=0 → can_hatch always true
    expect(body.eggs[0].can_hatch).toBe(true)
    expect(body.eggs[0].steps_progress).toBe(0)
    // Egg 2: 300 - 100 = 200 progress, needs 500 → can't hatch yet
    expect(body.eggs[1].can_hatch).toBe(false)
    expect(body.eggs[1].steps_progress).toBe(200)
  })

  it('can_hatch becomes true when steps_progress meets required', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock({ stepsWalked: 700 }) as any)
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    const body = await res.json()
    expect(body.eggs[1].can_hatch).toBe(true)
    // steps_progress is capped at steps_required (clean UI display)
    expect(body.eggs[1].steps_progress).toBe(500)
  })

  it('returns empty list when no eggs', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock({ eggs: [] }) as any)
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    const body = await res.json()
    expect(body.eggs).toEqual([])
  })
})
