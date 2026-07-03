import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/auth-fast', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/game/rewards/dispense', () => ({
  dispenseReward: vi.fn(async (_c: any, input: any) => ({ type: input.type, ok: true, detail: {} })),
}))
vi.mock('@/lib/game/tutorial', () => ({ isTutorialSession: (s: string) => s === 'tut' }))

import { POST } from '../route'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispenseReward } from '@/lib/game/rewards/dispense'

const USER = { id: 'u1', email: undefined, role: 'authenticated', app_metadata: {}, user_metadata: {} }
const req = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })

function buildSupabase(opts: {
  pergamena?: { id: string } | null
  claimRows?: Array<{ id: string }>
  ownedAnecdoteIds?: string[]
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { status: 'active' } }) }) }),
      }
      if (table === 'player_pergamene') return {
        select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: () => ({
          maybeSingle: async () => ({ data: opts.pergamena === undefined ? { id: 'pg1' } : opts.pergamena }),
        }) }) }) }) }) }),
        update: vi.fn(() => ({ eq: () => ({ is: () => ({
          select: async () => ({ data: opts.claimRows ?? [{ id: 'pg1' }] }),
        }) }) })),
      }
      if (table === 'player_collection') return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({
          data: (opts.ownedAnecdoteIds ?? []).map(id => ({ ref_id: id })),
        }) }) }) }),
      }
      return {}
    }),
  }
}

function buildAdmin(anecdotes: Array<{ id: string; title: string }> = [{ id: 'an1', title: 'Storia' }]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'anecdotes') return { select: () => Promise.resolve({ data: anecdotes }) }
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

describe('POST /api/game/pergamene/open', () => {
  it('opens: random unowned anecdote + gemme', async () => {
    const res = await POST(req({ sessionId: 's1' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.drops).toHaveLength(2)
    expect((dispenseReward as any).mock.calls[0][1]).toMatchObject({ type: 'aneddoto', payload: { anecdote_id: 'an1' } })
    expect((dispenseReward as any).mock.calls[1][1]).toMatchObject({ type: 'gemme', payload: { amount: 3 } })
  })

  it('falls back to gold when every anecdote is owned', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase({ ownedAnecdoteIds: ['an1'] }), user: USER })
    const res = await POST(req({ sessionId: 's1' }))
    expect(res.status).toBe(200)
    expect((dispenseReward as any).mock.calls[0][1]).toMatchObject({ type: 'gold', payload: { amount: 10 } })
  })

  it('404 when there is nothing to open', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase({ pergamena: null }), user: USER })
    const res = await POST(req({ sessionId: 's1' }))
    expect(res.status).toBe(404)
  })

  it('409 when the atomic claim loses the race', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase({ claimRows: [] }), user: USER })
    const res = await POST(req({ sessionId: 's1' }))
    expect(res.status).toBe(409)
  })

  it('401 unauthenticated', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: null })
    expect((await POST(req({ sessionId: 's1' }))).status).toBe(401)
  })
})
