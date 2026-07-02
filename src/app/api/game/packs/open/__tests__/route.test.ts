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

const POOL_ROWS = [
  { reward_type: 'gold', reward_payload: {}, weight: 70, min_qty: 10, max_qty: 10 },
  { reward_type: 'oggetto', reward_payload: { item_id: 'i1' }, weight: 30, min_qty: 1, max_qty: 1 },
]

function req(body: any) {
  return new Request('http://x/api/game/packs/open', { method: 'POST', body: JSON.stringify(body) })
}

function buildSupabase(sessionStatus = 'active') {
  return {
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: sessionStatus ? { status: sessionStatus } : null }) }) }),
      }
      return {}
    }),
  }
}

let deleteSpy: ReturnType<typeof vi.fn>
let updateEqSpy: ReturnType<typeof vi.fn>
let insertSpy: ReturnType<typeof vi.fn>

function buildAdmin(opts: { owned?: { id: string; quantity: number } | null; pack?: any; pool?: any[] } = {}) {
  const owned = opts.owned === undefined ? { id: 'pp1', quantity: 2 } : opts.owned
  const pack = opts.pack === undefined ? { id: 'pk1', name: 'Bustina di Bronzo', image_url: '', rarity: 'comune', min_drops: 3, max_drops: 5 } : opts.pack
  const pool = opts.pool === undefined ? POOL_ROWS : opts.pool
  deleteSpy = vi.fn(() => ({ eq: async () => ({ error: null }) }))
  updateEqSpy = vi.fn(async () => ({ error: null }))
  insertSpy = vi.fn(() => Promise.resolve({ error: null }))
  return {
    from: vi.fn((table: string) => {
      if (table === 'player_packs') return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: owned }) }) }) }) }),
        delete: deleteSpy,
        update: vi.fn(() => ({ eq: updateEqSpy })),
      }
      if (table === 'packs') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: pack }) }) }),
      }
      if (table === 'pack_pool') return {
        select: () => ({ eq: async () => ({ data: pool }) }),
      }
      if (table === 'player_game_events') return { insert: insertSpy }
      return {}
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: USER })
})

describe('POST /api/game/packs/open', () => {
  it('draws 3–5 rewards, dispenses each, and decrements the pack', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin())
    const res = await POST(req({ packId: 'pk1', sessionId: 's1' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.drops.length).toBeGreaterThanOrEqual(3)
    expect(json.drops.length).toBeLessThanOrEqual(5)
    expect((dispenseReward as any).mock.calls.length).toBe(json.drops.length)
    // quantity was 2 → update to 1 (not delete)
    expect(updateEqSpy).toHaveBeenCalledWith('id', 'pp1')
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('deletes the row when the last pack is opened', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ owned: { id: 'pp1', quantity: 1 } }))
    const res = await POST(req({ packId: 'pk1', sessionId: 's1' }))
    expect(res.status).toBe(200)
    expect(deleteSpy).toHaveBeenCalled()
  })

  it('422 when the player does not own the pack', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ owned: null }))
    const res = await POST(req({ packId: 'pk1', sessionId: 's1' }))
    expect(res.status).toBe(422)
    expect((await res.json()).notOwned).toBe(true)
  })

  it('422 when the pack has no pool entries', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ pool: [] }))
    const res = await POST(req({ packId: 'pk1', sessionId: 's1' }))
    expect(res.status).toBe(422)
  })

  it('403 when the session is not active', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase('ended'), user: USER })
    ;(createAdminClient as any).mockReturnValue(buildAdmin())
    const res = await POST(req({ packId: 'pk1', sessionId: 's1' }))
    expect(res.status).toBe(403)
  })

  it('401 when unauthenticated', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: null })
    const res = await POST(req({ packId: 'pk1', sessionId: 's1' }))
    expect(res.status).toBe(401)
  })
})
