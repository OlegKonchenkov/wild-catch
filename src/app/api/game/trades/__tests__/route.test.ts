import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/auth-fast', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendPushToUser: vi.fn(async () => {}), getDisplayName: vi.fn(async () => 'Oleg') }))
vi.mock('next/server', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return { ...actual, after: vi.fn() }
})

import { POST, PATCH } from '../route'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'

const USER = { id: 'u1', email: undefined, role: 'authenticated', app_metadata: {}, user_metadata: {} }
const req = (method: string, b: any) => new Request('http://x', { method, body: JSON.stringify(b) })

let rpcSpy: ReturnType<typeof vi.fn>

function buildAdmin(opts: {
  friendship?: boolean
  myDupes?: number
  theirDupes?: number
  trade?: any
  rpcError?: any
  pendingCount?: number
} = {}) {
  rpcSpy = vi.fn(async () => ({ error: opts.rpcError ?? null }))
  return {
    rpc: rpcSpy,
    from: vi.fn((table: string) => {
      if (table === 'friendships') return {
        select: () => ({ eq: () => ({ or: () => ({ maybeSingle: async () => ({ data: opts.friendship === false ? null : { id: 'f1' } }) }) }) }),
      }
      if (table === 'player_creatures') return {
        select: vi.fn()
          .mockReturnValueOnce({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { duplicates_count: opts.myDupes ?? 2 } }) }) }) }) })
          .mockReturnValueOnce({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { duplicates_count: opts.theirDupes ?? 2 } }) }) }) }) }),
      }
      if (table === 'trades') return {
        select: (_sel: string, o?: any) => o?.head
          ? { eq: () => ({ eq: async () => ({ count: opts.pendingCount ?? 0 }) }) }
          : {
              eq: () => ({ maybeSingle: async () => ({ data: opts.trade ?? null }) }),
              insert: undefined,
            },
        insert: vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: 't1' }, error: null }) }) })),
        update: vi.fn(() => ({ eq: async () => ({ error: null }) })),
      }
      if (table === 'player_game_events') return { insert: vi.fn(() => Promise.resolve({ error: null })) }
      return {}
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getAuthUser as any).mockResolvedValue({ supabase: {}, user: USER })
})

describe('POST /api/game/trades (proponi)', () => {
  it('propone tra amici con doppioni', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin())
    const res = await POST(req('POST', { friendId: 'u2', offerCreatureId: 'c1', requestCreatureId: 'c2', sessionId: 's1' }))
    expect(res.status).toBe(200)
  })
  it('403 se non amici', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ friendship: false }))
    expect((await POST(req('POST', { friendId: 'u2', offerCreatureId: 'c1', requestCreatureId: 'c2', sessionId: 's1' }))).status).toBe(403)
  })
  it('422 se offro la mia unica copia', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ myDupes: 1 }))
    expect((await POST(req('POST', { friendId: 'u2', offerCreatureId: 'c1', requestCreatureId: 'c2', sessionId: 's1' }))).status).toBe(422)
  })
})

describe('PATCH /api/game/trades (rispondi)', () => {
  const PENDING = { id: 't1', proposer_id: 'u2', recipient_id: 'u1', status: 'pending', session_id: 's1' }

  it('accept: esegue la RPC atomica', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ trade: PENDING }))
    const res = await PATCH(req('PATCH', { tradeId: 't1', action: 'accept' }))
    expect(res.status).toBe(200)
    expect(rpcSpy).toHaveBeenCalledWith('execute_trade', { p_trade_id: 't1', p_user_id: 'u1' })
  })
  it('422 se la RPC segnala doppione mancante', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ trade: PENDING, rpcError: { message: 'proposer_missing_duplicate' } }))
    expect((await PATCH(req('PATCH', { tradeId: 't1', action: 'accept' }))).status).toBe(422)
  })
  it('403 se accetta chi non è il destinatario', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ trade: { ...PENDING, recipient_id: 'u9' } }))
    expect((await PATCH(req('PATCH', { tradeId: 't1', action: 'accept' }))).status).toBe(403)
  })
  it('409 se già concluso', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ trade: { ...PENDING, status: 'accepted' } }))
    expect((await PATCH(req('PATCH', { tradeId: 't1', action: 'accept' }))).status).toBe(409)
  })
})
