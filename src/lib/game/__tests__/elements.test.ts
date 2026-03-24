import { describe, it, expect } from 'vitest'
import { getElementMultiplier } from '@/lib/game/elements'

describe('getElementMultiplier', () => {
  it('fiamma vs bosco = 1.5 (advantage)', () => {
    expect(getElementMultiplier('fiamma', 'bosco')).toBe(1.5)
  })

  it('fiamma vs adriatico = 1.0 (neutral from fiamma attack perspective)', () => {
    expect(getElementMultiplier('fiamma', 'adriatico')).toBe(1.0)
  })

  it('adriatico vs fiamma = 1.5 (adriatico strong against fiamma)', () => {
    expect(getElementMultiplier('adriatico', 'fiamma')).toBe(1.5)
  })

  it('bosco vs bosco = 1.0 (neutral)', () => {
    expect(getElementMultiplier('bosco', 'bosco')).toBe(1.0)
  })

  it('armonia gets +15% base bonus', () => {
    expect(getElementMultiplier('armonia', 'fiamma')).toBe(1.15)
  })
})
