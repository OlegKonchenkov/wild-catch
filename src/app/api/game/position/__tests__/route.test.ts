import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: null })),
        single: vi.fn(async () => ({ data: null })),
        in: vi.fn(() => ({ not: vi.fn(async () => ({ data: [] })) })),
      })) })),
      insert: vi.fn(async () => ({ error: null, data: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ is: vi.fn(() => ({ select: vi.fn(async () => ({ data: [], error: null })) })) })),
      })),
      or: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [] })) })),
      rpc: vi.fn(async () => ({ data: null, error: null })),
    })),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  })),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitResponse: vi.fn(),
}))
vi.mock('@/lib/game/missions', () => ({
  loadMissionUnlockContext: vi.fn(async () => ({ playerLevel: 1, completedMissionIds: [] })),
  normalizeMissionTargets: vi.fn((t: any) => [t].flat()),
  missionMatchesTarget: vi.fn(() => true),
}))
vi.mock('@/lib/game/mission-unlocks', () => ({
  getMissionUnlockState: vi.fn(() => ({ unlocked: true })),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

function buildMock({
  playerSession = { id: 'ps-1', last_position: null, last_position_at: null, steps_walked: 0 },
  session = { status: 'active', area_bounds: null, end_at: null },
} = {}) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: playerSession })),
          })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
      if (table === 'sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: session })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
      if (table === 'player_eggs') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            is: vi.fn(async () => ({ data: [] })),
          })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ is: vi.fn(() => ({ select: vi.fn(async () => ({ data: [] })) })) })) })),
      }
      if (table === 'missions') return {
        select: vi.fn(() => ({ or: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [] })) })) })),
      }
      if (table === 'player_missions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(async () => ({ data: [] })) })) })),
        })),
        insert: vi.fn(async () => ({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ is: vi.fn(() => ({ select: vi.fn(async () => ({ data: [] })) })) })) })),
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
    }),
  }
}

describe('POST /api/game/position', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ lat: 45.0, lng: 13.0, accuracy: 10, sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when required fields are missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ accuracy: 10, sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(400)
  })

  it('200 with valid GPS position for an active session', async () => {
    // Spy so random < 0.30 to trigger encounter
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ lat: 45.6495, lng: 13.7768, accuracy: 10, sessionId: 'sess-1' }),
    }))
    vi.restoreAllMocks()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.sessionStatus).toBe('active')
  })

  it('sessionEnded:true when session status is ended', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({
      session: { status: 'ended', area_bounds: null, end_at: null },
    }) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ lat: 45.0, lng: 13.0, accuracy: 10, sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionEnded).toBe(true)
  })
})
