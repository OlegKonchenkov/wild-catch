import { describe, it, expect } from 'vitest'
import { gymDefenseMultiplier, gymAccruedGold } from '../gym'

const NOW = new Date('2026-07-03T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

describe('gymDefenseMultiplier', () => {
  it('no hold → base stats', () => {
    expect(gymDefenseMultiplier(null, NOW)).toBe(1)
  })
  it('fresh hold defends at +25%', () => {
    expect(gymDefenseMultiplier(hoursAgo(0), NOW)).toBeCloseTo(1.25, 5)
  })
  it('decays 5% per hour', () => {
    expect(gymDefenseMultiplier(hoursAgo(1), NOW)).toBeCloseTo(1.20, 5)
    expect(gymDefenseMultiplier(hoursAgo(5), NOW)).toBeCloseTo(1.00, 5)
    expect(gymDefenseMultiplier(hoursAgo(7), NOW)).toBeCloseTo(0.90, 5)
  })
  it('floors at -20%', () => {
    expect(gymDefenseMultiplier(hoursAgo(48), NOW)).toBeCloseTo(0.80, 5)
  })
})

describe('gymAccruedGold', () => {
  it('10 gold per hour, floored', () => {
    expect(gymAccruedGold(hoursAgo(0), NOW)).toBe(0)
    expect(gymAccruedGold(hoursAgo(2.5), NOW)).toBe(25)
  })
  it('caps at 240', () => {
    expect(gymAccruedGold(hoursAgo(100), NOW)).toBe(240)
  })
})
