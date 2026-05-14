import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()

const PLAYERS = [
  { user_id: 'user-1', score: 500 },
  { user_id: 'user-2', score: 300 },
  { user_id: 'user-3', score: 100 },
]
const PROFILES = [
  { user_id: 'user-1', nickname: 'Alice' },
  { user_id: 'user-2', nickname: 'Bob' },
  // user-3 has no profile row → falls back to 'Anonimo'
]

function buildAdminMock(players = PLAYERS) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: players })),
            })),
          })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

function buildSupabaseMock(profiles = PROFILES) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: profiles })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

function makeRequest(url: string) {
  return new Request(url, { method: 'GET' })
}

describe('GET /api/game/leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
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

  it('returns leaderboard sorted by score desc with rank + nicknames', async () => {
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.leaderboard).toHaveLength(3)
    expect(body.leaderboard[0]).toEqual({
      rank: 1, user_id: 'user-1', nickname: 'Alice', score: 500, isMe: true,
    })
    expect(body.leaderboard[1].nickname).toBe('Bob')
    // No profile → fallback nickname
    expect(body.leaderboard[2].nickname).toBe('Anonimo')
    expect(body.leaderboard[2].isMe).toBe(false)
  })

  it('returns empty array when no players in session', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock([]) as any)
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    const body = await res.json()
    expect(body.leaderboard).toEqual([])
  })
})
