import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/auth-fast', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/game/rewards/dispense', () => ({ dispenseReward: vi.fn(async () => ({ type: 'bustina', ok: true, detail: {} })) }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ success: true })), rateLimitResponse: vi.fn() }))
vi.mock('@/lib/game/tutorial', () => ({ isTutorialSession: (s: string) => s === 'tut' }))

import { POST } from '../route'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispenseReward } from '@/lib/game/rewards/dispense'

const USER = { id: 'u1', email: undefined, role: 'authenticated', app_metadata: {}, user_metadata: {} }
const req = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })

let updateEqChain: any
function buildSupabase(ps: any = { id: 'ps1', gold: 500, gemme: 50 }, status = 'active') {
  updateEqChain = vi.fn(() => ({ select: async () => ({ data: [{ id: 'ps1' }], error: null }) }))
  return {
    from: vi.fn((t: string) => {
      if (t === 'sessions') return { select: () => ({ eq: () => ({ single: async () => ({ data: { status } }) }) }) }
      if (t === 'player_sessions') return {
        select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: ps }) }) }) }),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: updateEqChain, select: async () => ({ data: [{ id: 'ps1' }], error: null }) })) })),
      }
      return {}
    }),
  }
}
function buildAdmin(pack: any = { id: 'pk1', name: 'Bustina d\'Oro', price_gold: 800, price_gemme: 40 }) {
  return { from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: pack }) }) }) })) }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: USER })
  ;(createAdminClient as any).mockReturnValue(buildAdmin())
})

describe('POST /api/game/shop/buy-pack', () => {
  it('buys with gemme and dispenses the pack', async () => {
    const res = await POST(req({ packId: 'pk1', sessionId: 's1', currency: 'gemme' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.remainingGemme).toBe(10) // 50 - 40
    expect(dispenseReward).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'bustina' }))
  })

  it('402 when gemme insufficient', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase({ id: 'ps1', gold: 500, gemme: 5 }), user: USER })
    const res = await POST(req({ packId: 'pk1', sessionId: 's1', currency: 'gemme' }))
    expect(res.status).toBe(402)
  })

  it('400 when the pack has no price in that currency', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ id: 'pk1', name: 'X', price_gold: 300, price_gemme: null }))
    const res = await POST(req({ packId: 'pk1', sessionId: 's1', currency: 'gemme' }))
    expect(res.status).toBe(400)
  })

  it('403 inside the tutorial session', async () => {
    const res = await POST(req({ packId: 'pk1', sessionId: 'tut', currency: 'gold' }))
    expect(res.status).toBe(403)
  })

  it('401 when unauthenticated', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: null })
    const res = await POST(req({ packId: 'pk1', sessionId: 's1' }))
    expect(res.status).toBe(401)
  })
})
