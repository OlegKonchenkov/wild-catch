import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/game/missions', () => ({
  incrementMissionProgress: vi.fn(async () => []),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitResponse: vi.fn(),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()

const ENIGMA = {
  id: 'enigma-1',
  session_id: 'sess-1',
  solution: 'Anima',
  reward_type: 'gold',
  reward_payload: { gold: 100, exp: 50 },
  title: 'Test enigma',
}

function buildAdminMock({
  enigma = ENIGMA as any,
  existingSolve = null as any,
  playerSession = { id: 'ps-1' } as any,
  insertError = null as any,
  playerGold = 50,
}: any = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: playerSession })),
            single: vi.fn(async () => ({ data: { gold: playerGold } })),
          })) })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        })),
      }
      if (table === 'enigmi') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: enigma })),
          })),
        })),
      }
      if (table === 'player_enigmi') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: existingSolve })),
          })) })) })),
        })),
        insert: vi.fn(async () => ({ error: insertError })),
      }
      if (table === 'player_game_events') return {
        insert: vi.fn(() => ({ then: (_: any, __: any) => undefined })),
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })),
        rpc: vi.fn(async () => ({ data: null })),
      }
    }),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }
}

function makeReq(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/game/enigmi/solve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: mockGetUser } } as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeReq({ enigmaId: 'e', sessionId: 's', answer: 'x' }))
    expect(res.status).toBe(401)
  })

  it('400 when required fields are missing', async () => {
    const res = await POST(makeReq({ enigmaId: 'e' }))
    expect(res.status).toBe(400)
  })

  it('404 when player_sessions row is missing', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({ playerSession: null }) as any)
    const res = await POST(makeReq({ enigmaId: 'enigma-1', sessionId: 'sess-1', answer: 'anima' }))
    expect(res.status).toBe(404)
  })

  it('404 when enigma not found', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({ enigma: null }) as any)
    const res = await POST(makeReq({ enigmaId: 'enigma-1', sessionId: 'sess-1', answer: 'anima' }))
    expect(res.status).toBe(404)
  })

  it('403 when enigma belongs to a different session', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
      enigma: { ...ENIGMA, session_id: 'sess-other' },
    }) as any)
    const res = await POST(makeReq({ enigmaId: 'enigma-1', sessionId: 'sess-1', answer: 'anima' }))
    expect(res.status).toBe(403)
  })

  it('returns correct:true alreadySolved when already solved (idempotent)', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
      existingSolve: { id: 'pe-1', solved_at: '2026-05-15T10:00:00Z' },
    }) as any)
    const res = await POST(makeReq({ enigmaId: 'enigma-1', sessionId: 'sess-1', answer: 'anima' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.correct).toBe(true)
    expect(body.alreadySolved).toBe(true)
  })

  it('returns correct:false on wrong answer (case-insensitive)', async () => {
    const res = await POST(makeReq({ enigmaId: 'enigma-1', sessionId: 'sess-1', answer: 'sbagliata' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.correct).toBe(false)
  })

  it('returns correct:true + reward on correct answer (case + whitespace normalized)', async () => {
    const res = await POST(makeReq({ enigmaId: 'enigma-1', sessionId: 'sess-1', answer: '  ANIMA  ' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.correct).toBe(true)
    expect(body.alreadySolved).toBe(false)
    expect(body.reward).toBeDefined()
  })
})
