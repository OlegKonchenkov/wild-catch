import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: vi.fn(() => ({ then: (_: any, __: any) => undefined })) })),
  })),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

const EGG = { id: 'egg-1', egg_rarity: 'comune', steps_required: 0, steps_at_pickup: 0, hatched_at: null as string | null }
const CREATURE = { id: 'cr-1', name: 'Fiammare', rarity: 'comune', element: 'fiamma', image_url: null, sprite_url: null, hp: 60, atk: 20, def: 10, description: null, status_effect: null, status_effect_chance: null }

function buildMock({
  egg = EGG,
  stepsWalked = 100,
} = {}) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'player_eggs') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: egg })),
          })) })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { steps_walked: stepsWalked } })),
          })) })),
        })),
      }
      if (table === 'creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [CREATURE] })) })),
        })),
      }
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })) })) })),
        })),
        upsert: vi.fn(async () => ({ error: null })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

describe('POST /api/game/eggs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }) }),
      { params: Promise.resolve({ id: 'egg-1' }) },
    )
    expect(res.status).toBe(401)
  })

  it('400 when sessionId is missing', async () => {
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: 'egg-1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('409 when egg is already hatched', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({
      egg: { ...EGG, hatched_at: '2026-01-01T00:00:00Z' },
    }) as any)
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }) }),
      { params: Promise.resolve({ id: 'egg-1' }) },
    )
    expect(res.status).toBe(409)
  })

  it('200 hatched:true with creature when steps are sufficient', async () => {
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }) }),
      { params: Promise.resolve({ id: 'egg-1' }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.hatched).toBe(true)
    expect(body.creature).toMatchObject({ id: 'cr-1', name: 'Fiammare' })
  })
})
