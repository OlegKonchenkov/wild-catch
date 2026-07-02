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

const CHEST = {
  id: 'ch1', name: 'Forziere del Foro', image_url: '', rarity: 'raro',
  key_requirements: [{ item_id: 'bronze', qty: 1 }],
  contents: [{ type: 'gold', payload: { amount: 100 } }, { type: 'oggetto', payload: { item_id: 'i1' } }],
}

function req(body: any) {
  return new Request('http://x/api/game/chests/open', { method: 'POST', body: JSON.stringify(body) })
}

function buildSupabase(sessionStatus = 'active') {
  return {
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { status: sessionStatus } }) }) }),
      }
      return {}
    }),
  }
}

let invDelete: ReturnType<typeof vi.fn>
let invUpdateEq: ReturnType<typeof vi.fn>
let chestDelete: ReturnType<typeof vi.fn>
let chestUpdateEq: ReturnType<typeof vi.fn>

function buildAdmin(opts: { owned?: any; chest?: any; keyRows?: any[] } = {}) {
  const owned = opts.owned === undefined ? { id: 'pch1', quantity: 1 } : opts.owned
  const chest = opts.chest === undefined ? CHEST : opts.chest
  const keyRows = opts.keyRows === undefined ? [{ id: 'inv-b', item_id: 'bronze', quantity: 2 }] : opts.keyRows
  invDelete = vi.fn(() => ({ eq: async () => ({ error: null }) }))
  invUpdateEq = vi.fn(async () => ({ error: null }))
  chestDelete = vi.fn(() => ({ eq: async () => ({ error: null }) }))
  chestUpdateEq = vi.fn(async () => ({ error: null }))
  return {
    from: vi.fn((table: string) => {
      if (table === 'player_chests') return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: owned }) }) }) }) }),
        delete: chestDelete,
        update: vi.fn(() => ({ eq: chestUpdateEq })),
      }
      if (table === 'chests') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: chest }) }) }),
      }
      if (table === 'player_inventory') return {
        select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: keyRows }) }) }) }),
        delete: invDelete,
        update: vi.fn(() => ({ eq: invUpdateEq })),
      }
      if (table === 'items') return {
        select: () => ({ in: async () => ({ data: [{ id: 'bronze', name: 'Chiave di Bronzo' }] }) }),
      }
      if (table === 'player_game_events') return { insert: vi.fn(() => Promise.resolve({ error: null })) }
      return {}
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: USER })
})

describe('POST /api/game/chests/open', () => {
  it('opens the chest, consumes keys, and dispenses fixed contents', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin())
    const res = await POST(req({ chestId: 'ch1', sessionId: 's1' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.contents).toHaveLength(2)
    expect((dispenseReward as any).mock.calls.length).toBe(2)
    // bronze had 2, needed 1 → update to 1 (not delete)
    expect(invUpdateEq).toHaveBeenCalledWith('id', 'inv-b')
    // last chest → delete
    expect(chestDelete).toHaveBeenCalled()
  })

  it('422 with the missing key when the player lacks it', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ keyRows: [] }))
    const res = await POST(req({ chestId: 'ch1', sessionId: 's1' }))
    const json = await res.json()
    expect(res.status).toBe(422)
    expect(json.missingKeys).toBe(true)
    expect(json.missing[0]).toMatchObject({ item_id: 'bronze', needed: 1, have: 0, name: 'Chiave di Bronzo' })
    expect(dispenseReward as any).not.toHaveBeenCalled()
  })

  it('deletes the key row when the last key is consumed', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ keyRows: [{ id: 'inv-b', item_id: 'bronze', quantity: 1 }] }))
    const res = await POST(req({ chestId: 'ch1', sessionId: 's1' }))
    expect(res.status).toBe(200)
    expect(invDelete).toHaveBeenCalled()
  })

  it('422 when the player does not own the chest', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ owned: null }))
    const res = await POST(req({ chestId: 'ch1', sessionId: 's1' }))
    expect(res.status).toBe(422)
    expect((await res.json()).notOwned).toBe(true)
  })

  it('401 when unauthenticated', async () => {
    ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: null })
    const res = await POST(req({ chestId: 'ch1', sessionId: 's1' }))
    expect(res.status).toBe(401)
  })
})
