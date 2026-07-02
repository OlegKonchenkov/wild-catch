import { describe, it, expect } from 'vitest'
import { drawFromPool, weightedPick, rollQuantity, rollDropCount, type PoolEntry } from '../draw'

/** Feed a scripted sequence of rand() values, looping if exhausted. */
function seq(values: number[]): () => number {
  let i = 0
  return () => values[(i++) % values.length]
}

const POOL: PoolEntry[] = [
  { reward_type: 'gold', reward_payload: {}, weight: 70, min_qty: 10, max_qty: 10 },
  { reward_type: 'oggetto', reward_payload: { item_id: 'i1' }, weight: 25, min_qty: 1, max_qty: 1 },
  { reward_type: 'bustina', reward_payload: { pack_id: 'p1' }, weight: 5, min_qty: 1, max_qty: 1 },
]

describe('weightedPick', () => {
  it('picks the first entry when rand lands in its band', () => {
    // total weight = 100; rand 0.0 → 0 < 70 → gold
    expect(weightedPick(POOL, () => 0.0)?.reward_type).toBe('gold')
  })
  it('picks the middle entry within its band', () => {
    // rand 0.8 → 80 → 80-70=10 <25 → oggetto
    expect(weightedPick(POOL, () => 0.8)?.reward_type).toBe('oggetto')
  })
  it('picks the rare tail entry', () => {
    // rand 0.99 → 99 → after gold(70)+oggetto(25)=95 → 4 <5 → bustina
    expect(weightedPick(POOL, () => 0.99)?.reward_type).toBe('bustina')
  })
  it('returns null for an empty pool', () => {
    expect(weightedPick([], () => 0.5)).toBeNull()
  })
})

describe('rollQuantity', () => {
  it('is inclusive of both ends', () => {
    expect(rollQuantity(2, 5, () => 0)).toBe(2)
    expect(rollQuantity(2, 5, () => 0.999)).toBe(5)
  })
  it('clamps min to 1', () => {
    expect(rollQuantity(0, 0, () => 0.5)).toBe(1)
  })
})

describe('rollDropCount', () => {
  it('returns a value in [min,max]', () => {
    expect(rollDropCount(3, 5, () => 0)).toBe(3)
    expect(rollDropCount(3, 5, () => 0.999)).toBe(5)
  })
})

describe('drawFromPool', () => {
  it('returns exactly `count` drops', () => {
    // Each slot consumes two rand() values: one to pick the entry, one for qty.
    // pick values → 0.0=gold, 0.8=oggetto, 0.99=bustina, 0.0=gold; 0.5 = qty filler.
    const drops = drawFromPool(POOL, 4, seq([0.0, 0.5, 0.8, 0.5, 0.99, 0.5, 0.0, 0.5]))
    expect(drops).toHaveLength(4)
    expect(drops.map(d => d.reward_type)).toEqual(['gold', 'oggetto', 'bustina', 'gold'])
  })

  it('folds rolled quantity into currency amount', () => {
    const pool: PoolEntry[] = [{ reward_type: 'gemme', reward_payload: {}, weight: 1, min_qty: 5, max_qty: 5 }]
    const [drop] = drawFromPool(pool, 1, () => 0)
    expect(drop.payload.amount).toBe(5)
  })

  it('keeps an explicit payload amount over the rolled quantity', () => {
    const pool: PoolEntry[] = [{ reward_type: 'gold', reward_payload: { amount: 100 }, weight: 1, min_qty: 1, max_qty: 3 }]
    const [drop] = drawFromPool(pool, 1, () => 0.99)
    expect(drop.payload.amount).toBe(100)
  })

  it('folds quantity into stackable rewards', () => {
    const pool: PoolEntry[] = [{ reward_type: 'oggetto', reward_payload: { item_id: 'i1' }, weight: 1, min_qty: 2, max_qty: 2 }]
    const [drop] = drawFromPool(pool, 1, () => 0)
    expect(drop.payload.quantity).toBe(2)
  })
})
