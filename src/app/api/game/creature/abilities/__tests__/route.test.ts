import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET, POST, DELETE } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

/** A chainable query stub: chaining returns itself; select-terminals resolve to
 *  `selectResult`, while update/insert/delete chains resolve to `{ error: null }`. */
function q(selectResult: unknown) {
  const state = { mutated: false }
  const b: Record<string, unknown> = {}
  const chain = () => b
  Object.assign(b, {
    select: chain, eq: chain, gt: chain, order: chain,
    update: () => { state.mutated = true; return b },
    insert: () => { state.mutated = true; return b },
    delete: () => { state.mutated = true; return b },
    single: async () => selectResult,
    maybeSingle: async () => selectResult,
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(state.mutated ? { error: null } : selectResult).then(res, rej),
  })
  return b
}

function buildSupabase(tables: Record<string, unknown>) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => q(tables[table] ?? { data: null })),
  }
}

function reqJson(method: string, body: unknown) {
  return new Request('http://x', { method, body: JSON.stringify(body) })
}
function reqUrl(qs: string) {
  return new Request(`http://x/api?${qs}`, { method: 'GET' })
}

const ABILITY = {
  id: 'ab-1', name: 'Furia di Magma', min_level: 20, min_rarity: 'raro', allowed_elements: ['fiamma'],
  power: 2, accuracy: 1, target: 'enemy', charge_turns: 0, recharge_turns: 0, cooldown: 0, max_uses: null,
  hits_min: 1, hits_max: 1, status_effect: null, status_chance: 0, self_status: null,
  heal_percent: 0, lifesteal_percent: 0, buff_atk: 0, buff_def: 0, debuff_atk: 0, debuff_def: 0,
}

// Sensible "happy path" table set; individual tests override entries.
function happyTables(over: Record<string, unknown> = {}) {
  return {
    sessions: { data: { status: 'active' } },
    player_creatures: { data: { id: 'pc-1', creatures: { element: 'fiamma', rarity: 'epico' } } },
    player_sessions: { data: { level: 30 } },
    abilities: { data: ABILITY },
    player_abilities: { data: { id: 'pa-1', quantity: 2 } },
    creature_abilities: { data: [] },
    ...over,
  }
}

describe('POST /api/game/creature/abilities (learn)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabase({}) as never)
    expect((await POST(reqJson('POST', {}))).status).toBe(401)
  })

  it('400 on missing params', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(happyTables()) as never)
    expect((await POST(reqJson('POST', { sessionId: 's' }))).status).toBe(400)
  })

  it('400 on invalid slot', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(happyTables()) as never)
    const res = await POST(reqJson('POST', { sessionId: 's', playerCreatureId: 'pc-1', abilityId: 'ab-1', slotIndex: 7 }))
    expect(res.status).toBe(400)
  })

  it('403 when session is not active', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(happyTables({ sessions: { data: { status: 'ended' } } })) as never)
    const res = await POST(reqJson('POST', { sessionId: 's', playerCreatureId: 'pc-1', abilityId: 'ab-1', slotIndex: 0 }))
    expect(res.status).toBe(403)
  })

  it('404 when the creature is not owned', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(happyTables({ player_creatures: { data: null } })) as never)
    const res = await POST(reqJson('POST', { sessionId: 's', playerCreatureId: 'pc-1', abilityId: 'ab-1', slotIndex: 0 }))
    expect(res.status).toBe(404)
  })

  it('400 when the level gate is not met', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(happyTables({ player_sessions: { data: { level: 5 } } })) as never)
    const res = await POST(reqJson('POST', { sessionId: 's', playerCreatureId: 'pc-1', abilityId: 'ab-1', slotIndex: 0 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Lv. 20')
  })

  it('400 when the element gate is not met', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(happyTables({
      player_creatures: { data: { id: 'pc-1', creatures: { element: 'bosco', rarity: 'epico' } } },
    })) as never)
    const res = await POST(reqJson('POST', { sessionId: 's', playerCreatureId: 'pc-1', abilityId: 'ab-1', slotIndex: 0 }))
    expect(res.status).toBe(400)
  })

  it('400 when the player owns no token', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(happyTables({ player_abilities: { data: null } })) as never)
    const res = await POST(reqJson('POST', { sessionId: 's', playerCreatureId: 'pc-1', abilityId: 'ab-1', slotIndex: 0 }))
    expect(res.status).toBe(400)
  })

  it('400 when the ability is already known', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(happyTables({
      creature_abilities: { data: [{ id: 'ca-1', slot_index: 1, ability_id: 'ab-1' }] },
    })) as never)
    const res = await POST(reqJson('POST', { sessionId: 's', playerCreatureId: 'pc-1', abilityId: 'ab-1', slotIndex: 0 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('già')
  })

  it('200 on a valid learn', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(happyTables()) as never)
    const res = await POST(reqJson('POST', { sessionId: 's', playerCreatureId: 'pc-1', abilityId: 'ab-1', slotIndex: 2 }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })
})

describe('DELETE /api/game/creature/abilities (forget)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('400 when the slot is already empty', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase({ creature_abilities: { data: null } }) as never)
    const res = await DELETE(reqJson('DELETE', { playerCreatureId: 'pc-1', slotIndex: 0 }))
    expect(res.status).toBe(400)
  })

  it('200 on a valid forget', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase({ creature_abilities: { data: { id: 'ca-1' } } }) as never)
    const res = await DELETE(reqJson('DELETE', { playerCreatureId: 'pc-1', slotIndex: 0 }))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/game/creature/abilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('400 on missing params', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase({}) as never)
    expect((await GET(reqUrl('playerCreatureId=pc-1'))).status).toBe(400)
  })

  it('200 returns moveset and tokens', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase({
      creature_abilities: { data: [{ slot_index: 0, ability_id: 'ab-1', abilities: ABILITY }] },
      player_abilities: { data: [{ ability_id: 'ab-1', quantity: 2, abilities: ABILITY }] },
    }) as never)
    const res = await GET(reqUrl('playerCreatureId=pc-1&sessionId=s'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.moveset).toHaveLength(1)
    expect(body.tokens).toHaveLength(1)
  })
})
