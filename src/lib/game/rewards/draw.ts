/**
 * Weighted random draw for pack (bustina) contents.
 *
 * A pack has a pool of possible drops, each with an integer `weight`. Opening a
 * pack draws `count` slots; each slot independently picks one pool entry with
 * probability proportional to its weight (draws are with replacement — the same
 * entry can appear in multiple slots, e.g. three copies of gold), then rolls a
 * quantity in `[min_qty, max_qty]`.
 *
 * `rand` is injectable (defaults to Math.random) so draws are deterministic in
 * tests.
 */

export interface PoolEntry {
  reward_type: string
  reward_payload: Record<string, any>
  weight: number
  min_qty: number
  max_qty: number
}

export interface Drop {
  reward_type: string
  payload: Record<string, any>
  quantity: number
}

/** Pick one entry from the pool weighted by `weight`. Returns null for an empty pool. */
export function weightedPick(pool: PoolEntry[], rand: () => number): PoolEntry | null {
  if (pool.length === 0) return null
  const total = pool.reduce((sum, e) => sum + Math.max(0, e.weight), 0)
  if (total <= 0) return pool[0]
  let r = rand() * total
  for (const entry of pool) {
    r -= Math.max(0, entry.weight)
    if (r < 0) return entry
  }
  return pool[pool.length - 1]
}

/** Roll an integer quantity in [min, max] inclusive. */
export function rollQuantity(min: number, max: number, rand: () => number): number {
  const lo = Math.max(1, Math.floor(min))
  const hi = Math.max(lo, Math.floor(max))
  return lo + Math.floor(rand() * (hi - lo + 1))
}

/**
 * Draw `count` drops from the pool. The drawn quantity is folded into the
 * payload's `amount`/`quantity` where relevant so the dispenser grants the
 * right multiple.
 */
export function drawFromPool(pool: PoolEntry[], count: number, rand: () => number = Math.random): Drop[] {
  const drops: Drop[] = []
  for (let i = 0; i < count; i++) {
    const entry = weightedPick(pool, rand)
    if (!entry) break
    const quantity = rollQuantity(entry.min_qty ?? 1, entry.max_qty ?? 1, rand)
    const payload = { ...entry.reward_payload }
    // Currencies read `amount`; stackable rewards read `quantity`. An explicit
    // payload value (set by the admin) wins; otherwise use the rolled quantity.
    if (['gold', 'exp', 'gemme'].includes(entry.reward_type)) {
      if (payload.amount == null) payload.amount = quantity
    } else if (payload.quantity == null) {
      payload.quantity = quantity
    }
    drops.push({ reward_type: entry.reward_type, payload, quantity })
  }
  return drops
}

/** How many slots a pack yields this open: a random int in [min_drops, max_drops]. */
export function rollDropCount(minDrops: number, maxDrops: number, rand: () => number = Math.random): number {
  return rollQuantity(minDrops, maxDrops, rand)
}
