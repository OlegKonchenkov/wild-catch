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
import { romeDateKey, prevDateKey } from '@/lib/game/daily'

const USER = { id: 'u1', email: undefined, role: 'authenticated', app_metadata: {}, user_metadata: {} }
const req = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })

let insertSpy: ReturnType<typeof vi.fn>

function buildSupabase(opts: {
  session?: any
  lastClaim?: { claim_date: string; streak: number } | null
  insertError?: any
} = {}) {
  const session = opts.session === undefined
    ? { status: 'active', daily_rewards_enabled: true, daily_pack_id: 'pk1' }
    : opts.session
  insertSpy = vi.fn(async () => ({ error: opts.insertError ?? null }))
  return {
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: session }) }) }),
      }
      if (table === 'player_daily_claims') return {
        select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({
          maybeSingle: async () => ({ data: opts.lastClaim ?? null }),
        }) }) }) }) }),
        insert: insertSpy,
      }
      return {}
    }),
  }
}

function buildAdmin() {
  return {
    from: vi.fn(() => ({ insert: vi.fn(() => Promise.resolve({ error: null })) })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: USER })
  ;(createAdminClient as any).mockReturnValue(buildAdmin())
})

describe('POST /api/game/daily/claim', () => {
  it('first claim: streak 1, pack + gemme dispensed', async () => {
    const res = await POST(req({ sessionId: 's1' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.streak).toBe(1)
    expect(json.drops).toHaveLength(2) // bustina + gemme
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ claim_date: romeDateKey(), streak: 1 }))
    expect((dispenseReward as any).mock.calls[0][1]).toMatchObject({ type: 'bustina', payload: { pack_id: 'pk1', quantity: 1 } })
  })

  it('consecutive day: streak increments', async () => {
    const today = romeDateKey()
    ;(getAuthUser as any).mockResolvedValue({
      supabase: buildSupabase({ lastClaim: { claim_date: prevDateKey(today), streak: 3 } }), user: USER,
    })
    const res = await POST(req({ sessionId: 's1' }))
    expect((await res.json()).streak).toBe(4)
  })

  it('gap: streak resets to 1', async () => {
    ;(getAuthUser as any).mockResolvedValue({
      supabase: buildSupabase({ lastClaim: { claim_date: '2020-01-01', streak: 9 } }), user: USER,
    })
    const res = await POST(req({ sessionId: 's1' }))
    expect((await res.json()).streak).toBe(1)
  })

  it('409 when already claimed today', async () => {
    ;(getAuthUser as any).mockResolvedValue({
      supabase: buildSupabase({ lastClaim: { claim_date: romeDateKey(), streak: 2 } }), user: USER,
    })
    const res = await POST(req({ sessionId: 's1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).alreadyClaimed).toBe(true)
  })

  it('409 on concurrent insert collision (23505)', async () => {
    ;(getAuthUser as any).mockResolvedValue({
      supabase: buildSupabase({ insertError: { code: '23505', message: 'dup' } }), user: USER,
    })
    const res = await POST(req({ sessionId: 's1' }))
    expect(res.status).toBe(409)
  })

  it('403 when daily rewards disabled', async () => {
    ;(getAuthUser as any).mockResolvedValue({
      supabase: buildSupabase({ session: { status: 'active', daily_rewards_enabled: false } }), user: USER,
    })
    const res = await POST(req({ sessionId: 's1' }))
    expect(res.status).toBe(403)
  })

  it('403 when session not active', async () => {
    ;(getAuthUser as any).mockResolvedValue({
      supabase: buildSupabase({ session: { status: 'ended', daily_rewards_enabled: true } }), user: USER,
    })
    const res = await POST(req({ sessionId: 's1' }))
    expect(res.status).toBe(403)
  })

  it('401 unauthenticated', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: null })
    const res = await POST(req({ sessionId: 's1' }))
    expect(res.status).toBe(401)
  })
})
