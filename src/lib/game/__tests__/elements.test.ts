import { describe, it, expect } from 'vitest'
import { getElementMultiplier, strongAgainst, weakAgainst } from '@/lib/game/elements'
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
  // armonia attacks (×1.15 vs all except self — special reduced bonus,
  // offset by having no weaknesses)
  ['armonia', 'fiamma',    1.15],
  ['armonia', 'adriatico', 1.15],
  ['armonia', 'bosco',     1.15],
  ['armonia', 'terra',     1.15],
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

  // Armonia's special reduced advantage: strong vs all, but +15% not +50%.
  it('armonia gets +15% base bonus', () => {
    expect(getElementMultiplier('armonia', 'fiamma')).toBe(1.15)
  })
})

// Guards for the strong/weak display tables (guide, bestiary, tutorial modals).
// These derive from ELEMENT_MULTIPLIERS so the UI can never drift again — the
// tutorial modal previously hard-coded a table where Terra was blank and
// Adriatico/Bosco were wrong.
describe('strongAgainst', () => {
  const CASES: Array<[Element, Element[]]> = [
    ['fiamma',    ['bosco']],
    ['adriatico', ['fiamma']],
    ['bosco',     ['terra']],
    ['terra',     ['adriatico']],
    ['armonia',   ['fiamma', 'adriatico', 'bosco', 'terra']],
  ]
  it.each(CASES)('%s is strong against %s', (element, expected) => {
    expect(strongAgainst(element)).toEqual(expected)
  })
})

describe('weakAgainst', () => {
  const CASES: Array<[Element, Element[]]> = [
    ['fiamma',    ['adriatico']],
    ['adriatico', ['terra']],
    ['bosco',     ['fiamma']],
    ['terra',     ['bosco']],
    ['armonia',   []],
  ]
  it.each(CASES)('%s is weak against %s', (element, expected) => {
    expect(weakAgainst(element)).toEqual(expected)
  })

  it('Terra has both a strength and a weakness (was blank in the tutorial modal)', () => {
    expect(strongAgainst('terra')).not.toHaveLength(0)
    expect(weakAgainst('terra')).not.toHaveLength(0)
  })
})
