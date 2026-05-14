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
        // The handler now atomically claims the egg via
        //   .update(...).eq('id',…).eq('user_id',…).is('hatched_at', null).select('id')
        // Return one row (claim succeeded) only when the fixture's
        // hatched_at is still null — otherwise simulate "another request
        // beat us" by returning an empty array.
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                select: vi.fn(async () => ({
                  data: egg.hatched_at == null ? [{ id: egg.id }] : [],
                  error: null,
                })),
              })),
            })),
          })),
        })),
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

  it('409 when a concurrent request wins the atomic claim race', async () => {
    // The initial SELECT shows hatched_at=null (so the early guard passes)
    // but the atomic UPDATE … is(hatched_at, null) returns 0 rows because
    // another request grabbed the egg between the two queries. The
    // handler must abort with 409 and NOT grant a creature.
    const eggRaceMock = {
      auth: { getUser: mockGetUser },
      from: vi.fn((table: string) => {
        if (table === 'player_eggs') return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { ...EGG, hatched_at: null } })),
            })) })) })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  // Concurrent request beat us — zero rows updated
                  select: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          })),
        }
        if (table === 'player_sessions') return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { steps_walked: 100 } })),
            })) })),
          })),
        }
        if (table === 'creatures') return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [CREATURE] })) })),
          })),
        }
        // player_creatures.select would only be hit if the handler
        // erroneously granted a creature — test would fail by way of
        // the response code anyway.
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
      }),
    }
    vi.mocked(createClient).mockResolvedValue(eggRaceMock as any)
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }) }),
      { params: Promise.resolve({ id: 'egg-1' }) },
    )
    expect(res.status).toBe(409)
  })
})
