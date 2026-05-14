import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()

const PLAYER_SESSIONS = [
  {
    session_id: 'sess-real',
    exp: 100, gold: 50, level: 2,
    sessions: { id: 'sess-real', name: 'Sagra di Trieste', status: 'active', start_at: '2026-05-10T10:00:00Z', end_at: null, kind: 'event' },
  },
  {
    session_id: 'sess-tut',
    exp: 50, gold: 25, level: 1,
    sessions: { id: 'sess-tut', name: 'Tutorial', status: 'active', start_at: null, end_at: null, kind: 'tutorial' },
  },
]

function buildSupabaseMock(playerSessions: any[] = PLAYER_SESSIONS) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: playerSessions })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

function buildAdminMock({ creatures = [], duelsC = [], duelsO = [] }: any = {}) {
  // The handler runs TWO parallel queries on 'duels':
  //   (a) challenger_id = user → returns duelsC
  //   (b) opponent_id   = user → returns duelsO
  // Each query calls .from('duels') separately, so the counter must
  // live OUTSIDE the from() callback to be shared across calls.
  let duelsCallIdx = 0
  return {
    from: vi.fn((table: string) => {
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ in: vi.fn(async () => ({ data: creatures })) })),
        })),
      }
      if (table === 'duels') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(async () => {
              const idx = duelsCallIdx++
              return { data: idx === 0 ? duelsC : duelsO }
            }) })) })),
          })),
        }
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

describe('GET /api/game/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty when player has no sessions', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock([]) as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessions).toEqual([])
  })

  it('returns empty when player only has tutorial (filtered out)', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock([PLAYER_SESSIONS[1]]) as any)
    const res = await GET()
    const body = await res.json()
    expect(body.sessions).toEqual([])
  })

  it('returns real sessions (tutorial filtered out)', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessions).toHaveLength(1)
    expect(body.sessions[0].id).toBe('sess-real')
    expect(body.sessions[0].name).toBe('Sagra di Trieste')
    expect(body.sessions[0].exp).toBe(100)
  })

  it('includes creature count + duel stats per session', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
      creatures: [{ session_id: 'sess-real' }, { session_id: 'sess-real' }, { session_id: 'sess-real' }],
      duelsC: [
        { session_id: 'sess-real', winner_id: 'user-1' },
        { session_id: 'sess-real', winner_id: 'user-other' },
      ],
    }) as any)
    const res = await GET()
    const body = await res.json()
    expect(body.sessions[0].creatures_caught).toBe(3)
    expect(body.sessions[0].duel_total).toBe(2)
    expect(body.sessions[0].duel_wins).toBe(1)
  })
})
