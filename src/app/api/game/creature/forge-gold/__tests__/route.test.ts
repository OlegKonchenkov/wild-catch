import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/auth-fast', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn(() => ({ insert: vi.fn(() => Promise.resolve({ error: null })) })) })),
}))

import { POST } from '../route'
import { getAuthUser } from '@/lib/supabase/auth-fast'

const USER = { id: 'u1', email: undefined, role: 'authenticated', app_metadata: {}, user_metadata: {} }
const req = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })

let forgeUpdateSpy: ReturnType<typeof vi.fn>

function buildSupabase(opts: {
  pc?: any
  gemme?: number
  forgeRows?: Array<{ id: string }>
} = {}) {
  const pc = opts.pc === undefined
    ? { id: 'pc1', duplicates_count: 3, is_gold: false, creature: { name: 'Fenice' } }
    : opts.pc
  forgeUpdateSpy = vi.fn(() => ({
    eq: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: opts.forgeRows ?? [{ id: 'pc1' }], error: null }) }) }) }),
  }))
  return {
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { status: 'active' } }) }) }),
      }
      if (table === 'player_creatures') return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pc }) }) }) }) }),
        update: forgeUpdateSpy,
      }
      if (table === 'player_sessions') return {
        select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'ps1', gemme: opts.gemme ?? 100 } }) }) }) }),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: () => ({ select: async () => ({ data: [{ id: 'ps1' }], error: null }) }), select: async () => ({ data: [{ id: 'ps1' }], error: null }) })),
        })),
      }
      return {}
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: USER })
})

describe('POST /api/game/creature/forge-gold', () => {
  it('forges GOLD: consumes 2 copies + 25 gemme', async () => {
    const res = await POST(req({ playerCreatureId: 'pc1', sessionId: 's1' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.remainingGemme).toBe(75)
    expect(json.remainingCopies).toBe(1)
    expect(forgeUpdateSpy).toHaveBeenCalledWith({ duplicates_count: 1, is_gold: true })
  })

  it('422 with fewer than 3 copies', async () => {
    ;(getAuthUser as any).mockResolvedValue({
      supabase: buildSupabase({ pc: { id: 'pc1', duplicates_count: 2, is_gold: false, creature: { name: 'X' } } }), user: USER,
    })
    expect((await POST(req({ playerCreatureId: 'pc1', sessionId: 's1' }))).status).toBe(422)
  })

  it('409 when already GOLD', async () => {
    ;(getAuthUser as any).mockResolvedValue({
      supabase: buildSupabase({ pc: { id: 'pc1', duplicates_count: 5, is_gold: true, creature: { name: 'X' } } }), user: USER,
    })
    expect((await POST(req({ playerCreatureId: 'pc1', sessionId: 's1' }))).status).toBe(409)
  })

  it('402 with insufficient gemme', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase({ gemme: 10 }), user: USER })
    expect((await POST(req({ playerCreatureId: 'pc1', sessionId: 's1' }))).status).toBe(402)
  })

  it('409 + refund when the forge guard loses the race', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase({ forgeRows: [] }), user: USER })
    expect((await POST(req({ playerCreatureId: 'pc1', sessionId: 's1' }))).status).toBe(409)
  })
})
