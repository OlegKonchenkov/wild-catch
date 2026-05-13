import { describe, it, expect } from 'vitest'
import { getElementMultiplier } from '@/lib/game/elements'
import type { Element } from '@/lib/types'

// Full 5×5 type-chart derived from ELEMENT_MULTIPLIERS in types.ts.
// Row = attacker, Col = defender. 1.5 = advantage, 1.0 = neutral.
const TABLE: Array<[Element, Element, number]> = [
  // fiamma attacks
  ['fiamma', 'fiamma',    1.0],
  ['fiamma', 'adriatico', 1.0],
  ['fiamma', 'bosco',     1.5],
  ['fiamma', 'terra',     1.0],
  ['fiamma', 'armonia',   1.0],
  // adriatico attacks
  ['adriatico', 'fiamma',    1.5],
  ['adriatico', 'adriatico', 1.0],
  ['adriatico', 'bosco',     1.0],
  ['adriatico', 'terra',     1.0],
  ['adriatico', 'armonia',   1.0],
  // bosco attacks
  ['bosco', 'fiamma',    1.0],
  ['bosco', 'adriatico', 1.0],
  ['bosco', 'bosco',     1.0],
  ['bosco', 'terra',     1.5],
  ['bosco', 'armonia',   1.0],
  // terra attacks
  ['terra', 'fiamma',    1.0],
  ['terra', 'adriatico', 1.5],
  ['terra', 'bosco',     1.0],
  ['terra', 'terra',     1.0],
  ['terra', 'armonia',   1.0],
  // armonia attacks (×1.5 vs all except self)
  ['armonia', 'fiamma',    1.5],
  ['armonia', 'adriatico', 1.5],
  ['armonia', 'bosco',     1.5],
  ['armonia', 'terra',     1.5],
  ['armonia', 'armonia',   1.0],
]

describe('getElementMultiplier', () => {
  it.each(TABLE)('%s vs %s = %s', (attacker, defender, expected) => {
    expect(getElementMultiplier(attacker, defender)).toBe(expected)
  })

  it('unknown attacker element returns 1.0', () => {
    expect(getElementMultiplier('unknown' as Element, 'fiamma')).toBe(1.0)
  })

  it('unknown defender element returns 1.0', () => {
    expect(getElementMultiplier('fiamma', 'unknown' as Element)).toBe(1.0)
  })

  // Pre-existing balance assertion (currently failing — do not change)
  it('armonia gets +15% base bonus', () => {
    expect(getElementMultiplier('armonia', 'fiamma')).toBe(1.15)
  })
})
