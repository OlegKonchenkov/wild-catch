import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/game/grant-ability', () => ({
  grantAbility: vi.fn(async () => ({ granted: true, quantity: 1 })),
}))

import { dispenseReward } from '../dispense'
import { grantAbility } from '@/lib/game/grant-ability'

/**
 * Minimal chainable Supabase mock. Each table gets a spec describing what its
 * terminal calls resolve to; select chains ignore intermediate .eq() links.
 */
function makeClient(opts: {
  rpc?: (fn: string, args: any) => any
  tables?: Record<string, { selectData?: any; insert?: any; update?: any; upsert?: any }>
} = {}) {
  const rpc = vi.fn(async (fn: string, args: any) => (opts.rpc ? opts.rpc(fn, args) : { data: [{ new_level: 1, leveled_up: false }], error: null }))
  const insert = vi.fn(async () => ({ error: null }))
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
  const upsert = vi.fn(async () => ({ error: null }))

  function chain(terminalData: any): any {
    const node: any = {}
    node.select = vi.fn(() => node)
    node.eq = vi.fn(() => node)
    node.maybeSingle = vi.fn(async () => ({ data: terminalData }))
    node.single = vi.fn(async () => ({ data: terminalData }))
    node.insert = insert
    node.update = update
    node.upsert = upsert
    return node
  }

  const from = vi.fn((table: string) => {
    const spec = opts.tables?.[table] ?? {}
    const node = chain(spec.selectData ?? null)
    if (spec.insert !== undefined) node.insert = spec.insert
    if (spec.update !== undefined) node.update = spec.update
    if (spec.upsert !== undefined) node.upsert = spec.upsert
    return node
  })

  return { rpc, from, __insert: insert, __update: update, __upsert: upsert } as any
}

const BASE = { userId: 'u1', sessionId: 's1' }

beforeEach(() => vi.clearAllMocks())

describe('dispenseReward — currencies', () => {
  it('grants gemme via increment_player_stats with p_gemme', async () => {
    const c = makeClient()
    const r = await dispenseReward(c, { ...BASE, type: 'gemme', payload: { amount: 5 } })
    expect(r.ok).toBe(true)
    expect(r.detail.amount).toBe(5)
    expect(c.rpc).toHaveBeenCalledWith('increment_player_stats', expect.objectContaining({ p_gemme: 5, p_gold: 0, p_exp: 0 }))
  })

  it('grants gold via p_gold and reports level-up', async () => {
    const c = makeClient({ rpc: () => ({ data: [{ new_level: 3, leveled_up: true }], error: null }) })
    const r = await dispenseReward(c, { ...BASE, type: 'gold', payload: { amount: 100 } })
    expect(c.rpc).toHaveBeenCalledWith('increment_player_stats', expect.objectContaining({ p_gold: 100, p_gemme: 0 }))
    expect(r.detail.levelUp).toEqual({ newLevel: 3 })
  })

  it('grants exp with a score fraction', async () => {
    const c = makeClient()
    await dispenseReward(c, { ...BASE, type: 'exp', payload: { amount: 50 } })
    expect(c.rpc).toHaveBeenCalledWith('increment_player_stats', expect.objectContaining({ p_exp: 50, p_score: 5 }))
  })
})

describe('dispenseReward — items', () => {
  it('inserts a new inventory row when the player has none', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const c = makeClient({ tables: { player_inventory: { selectData: null, insert }, items: { selectData: { name: 'Rete' } } } })
    const r = await dispenseReward(c, { ...BASE, type: 'oggetto', payload: { item_id: 'i1', quantity: 2 } })
    expect(r.ok).toBe(true)
    expect(r.detail.itemName).toBe('Rete')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ item_id: 'i1', quantity: 2 }))
  })

  it('adds quantity when the item already exists', async () => {
    const eqUpdate = vi.fn(async () => ({ error: null }))
    const update = vi.fn(() => ({ eq: eqUpdate }))
    const c = makeClient({ tables: { player_inventory: { selectData: { id: 'inv1', quantity: 3 }, update }, items: { selectData: { name: 'Rete' } } } })
    await dispenseReward(c, { ...BASE, type: 'oggetto', payload: { item_id: 'i1', quantity: 2 } })
    expect(update).toHaveBeenCalledWith({ quantity: 5 })
  })

  it('fails when item_id is missing', async () => {
    const c = makeClient()
    const r = await dispenseReward(c, { ...BASE, type: 'oggetto', payload: {} })
    expect(r.ok).toBe(false)
  })
})

describe('dispenseReward — ability & creature', () => {
  it('grants an ability token via grantAbility', async () => {
    const c = makeClient({ tables: { abilities: { selectData: { name: 'Fulmine' } } } })
    const r = await dispenseReward(c, { ...BASE, type: 'abilita', payload: { abilityId: 'a1', quantity: 1 } })
    expect(grantAbility).toHaveBeenCalledWith(c, 'u1', 's1', 'a1', 1)
    expect(r.detail.abilityName).toBe('Fulmine')
  })

  it('increments duplicates for an already-owned creature', async () => {
    const eqUpdate = vi.fn(async () => ({ error: null }))
    const update = vi.fn(() => ({ eq: eqUpdate }))
    const c = makeClient({ tables: {
      player_creatures: { selectData: { id: 'pc1', duplicates_count: 1 }, update },
      creatures: { selectData: { id: 'c1', name: 'Fenice', rarity: 'raro', element: 'fiamma' } },
    } })
    const r = await dispenseReward(c, { ...BASE, type: 'creatura', payload: { creature_id: 'c1' } })
    expect(update).toHaveBeenCalledWith({ duplicates_count: 2 })
    expect(r.detail.creature.name).toBe('Fenice')
  })
})

describe('dispenseReward — bustina', () => {
  it('inserts a new player_packs row when the player owns none', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const c = makeClient({ tables: { player_packs: { selectData: null, insert }, packs: { selectData: { name: 'Bustina di Bronzo' } } } })
    const r = await dispenseReward(c, { ...BASE, type: 'bustina', payload: { pack_id: 'pk1', quantity: 2 } })
    expect(r.ok).toBe(true)
    expect(r.detail.packName).toBe('Bustina di Bronzo')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ pack_id: 'pk1', quantity: 2 }))
  })

  it('fails without a pack_id', async () => {
    const c = makeClient()
    const r = await dispenseReward(c, { ...BASE, type: 'bustina', payload: {} })
    expect(r.ok).toBe(false)
  })
})

describe('dispenseReward — forziere', () => {
  it('inserts a new player_chests row when the player owns none', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const c = makeClient({ tables: { player_chests: { selectData: null, insert }, chests: { selectData: { name: 'Forziere del Foro' } } } })
    const r = await dispenseReward(c, { ...BASE, type: 'forziere', payload: { chest_id: 'ch1' } })
    expect(r.ok).toBe(true)
    expect(r.detail.chestName).toBe('Forziere del Foro')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ chest_id: 'ch1', quantity: 1 }))
  })
})

describe('dispenseReward — not-yet-implemented loot types', () => {
  it('reports ok:false for premio until its phase lands', async () => {
    const c = makeClient()
    const r = await dispenseReward(c, { ...BASE, type: 'premio', payload: { prize_id: 'p1' } })
    expect(r.ok).toBe(false)
    expect(r.detail.error).toContain('premio')
  })
})
