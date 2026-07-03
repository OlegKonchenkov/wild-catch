import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/auth-fast', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/game/rewards/dispense', () => ({
  dispenseReward: vi.fn(async (_c: any, input: any) => ({ type: input.type, ok: true, detail: {} })),
}))

import { POST } from '../route'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispenseReward } from '@/lib/game/rewards/dispense'

const USER = { id: 'u1', email: undefined, role: 'authenticated', app_metadata: {}, user_metadata: {} }
const req = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })

let updateSpy: ReturnType<typeof vi.fn>
let insertSpy: ReturnType<typeof vi.fn>

function buildSupabase(opts: {
  sessionStatus?: string
  ownedAnecdote?: boolean
  state?: { id: string; attempts: number; solved_at: string | null } | null
} = {}) {
  updateSpy = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
  insertSpy = vi.fn(async () => ({ error: null }))
  return {
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { status: opts.sessionStatus ?? 'active' } }) }) }),
      }
      if (table === 'player_collection') return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: opts.ownedAnecdote ? { id: 'pc1' } : null }),
        }) }) }) }) }),
      }
      if (table === 'player_quizzes') return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: opts.state ?? null }),
          single: async () => ({ data: opts.state ?? null }),
        }) }) }) }),
        insert: insertSpy,
        update: updateSpy,
      }
      return {}
    }),
  }
}

function buildAdmin(quiz: any = { id: 'q1', correct_index: 2, reward: null, unlock_anecdote_id: null, question: 'Chi era Ovidio?' }) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'quizzes') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: quiz }) }) }),
      }
      if (table === 'player_game_events') return { insert: vi.fn(() => Promise.resolve({ error: null })) }
      return {}
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: USER })
  ;(createAdminClient as any).mockReturnValue(buildAdmin())
})

describe('POST /api/game/quiz/answer', () => {
  it('correct answer: solves + dispenses default 5 gemme', async () => {
    const res = await POST(req({ quizId: 'q1', sessionId: 's1', answerIndex: 2 }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.correct).toBe(true)
    expect(json.drops).toHaveLength(1)
    expect((dispenseReward as any).mock.calls[0][1]).toMatchObject({ type: 'gemme', payload: { amount: 5 } })
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1, solved_at: expect.any(String) }))
  })

  it('wrong answer: attempts++ but no reward', async () => {
    const res = await POST(req({ quizId: 'q1', sessionId: 's1', answerIndex: 0 }))
    const json = await res.json()
    expect(json.correct).toBe(false)
    expect(dispenseReward).not.toHaveBeenCalled()
    expect(insertSpy).toHaveBeenCalledWith(expect.not.objectContaining({ solved_at: expect.anything() }))
  })

  it('custom reward JSON overrides the default', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({
      id: 'q1', correct_index: 1, unlock_anecdote_id: null, question: 'X',
      reward: [{ type: 'bustina', payload: { pack_id: 'pk1' } }],
    }))
    await POST(req({ quizId: 'q1', sessionId: 's1', answerIndex: 1 }))
    expect((dispenseReward as any).mock.calls[0][1]).toMatchObject({ type: 'bustina' })
  })

  it('403 locked when the gating anecdote is not owned', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({
      id: 'q1', correct_index: 0, reward: null, unlock_anecdote_id: 'an1', question: 'X',
    }))
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase({ ownedAnecdote: false }), user: USER })
    const res = await POST(req({ quizId: 'q1', sessionId: 's1', answerIndex: 0 }))
    expect(res.status).toBe(403)
    expect((await res.json()).locked).toBe(true)
  })

  it('409 when already solved', async () => {
    ;(getAuthUser as any).mockResolvedValue({
      supabase: buildSupabase({ state: { id: 'pq1', attempts: 2, solved_at: '2026-07-01T10:00:00Z' } }), user: USER,
    })
    const res = await POST(req({ quizId: 'q1', sessionId: 's1', answerIndex: 2 }))
    expect(res.status).toBe(409)
  })

  it('403 when session not active', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase({ sessionStatus: 'ended' }), user: USER })
    const res = await POST(req({ quizId: 'q1', sessionId: 's1', answerIndex: 2 }))
    expect(res.status).toBe(403)
  })
})
