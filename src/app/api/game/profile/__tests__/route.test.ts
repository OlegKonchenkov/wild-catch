import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

function buildMock({
  playerSession = { exp: 250, gold: 100, level: 3 } as any,
  profile = { nickname: 'Alice', avatar_url: 'http://x/a.png' } as any,
  creaturesCount = 7,
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
      }
      if (table === 'profiles') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: profile })) })),
        })),
      }
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ count: creaturesCount })) })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

function makeRequest(url: string) {
  return new Request(url, { method: 'GET' })
}

describe('GET /api/game/profile', () => {
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

  it('404 when player not in session', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({ playerSession: null }) as any)
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    expect(res.status).toBe(404)
  })

  it('returns aggregated profile data on success', async () => {
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      exp: 250, gold: 100, gemme: 0, level: 3,
      nickname: 'Alice', avatar_url: 'http://x/a.png',
      creatures_caught: 7,
    })
  })

  it('falls back to Anonimo when no profile row', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({ profile: null }) as any)
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    const body = await res.json()
    expect(body.nickname).toBe('Anonimo')
    expect(body.avatar_url).toBeNull()
  })
})
