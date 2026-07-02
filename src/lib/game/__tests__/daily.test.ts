import { describe, it, expect } from 'vitest'
import { romeDateKey, prevDateKey, computeStreak, buildDailyRewards, DAILY_FALLBACK_GOLD } from '../daily'

describe('romeDateKey', () => {
  it('formats a UTC instant as the Rome calendar day', () => {
    // 23:30 UTC on Jan 1 is 00:30 Jan 2 in Rome (CET, +1)
    expect(romeDateKey(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-02')
    // 21:30 UTC on Jul 1 is 23:30 Jul 1 in Rome (CEST, +2)
    expect(romeDateKey(new Date('2026-07-01T21:30:00Z'))).toBe('2026-07-01')
    // 22:30 UTC on Jul 1 crosses to Jul 2 in Rome
    expect(romeDateKey(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02')
  })
})

describe('prevDateKey', () => {
  it('handles plain, month and year boundaries', () => {
    expect(prevDateKey('2026-07-02')).toBe('2026-07-01')
    expect(prevDateKey('2026-07-01')).toBe('2026-06-30')
    expect(prevDateKey('2026-01-01')).toBe('2025-12-31')
    expect(prevDateKey('2026-03-01')).toBe('2026-02-28')
  })
})

describe('computeStreak', () => {
  it('first claim starts at 1', () => {
    expect(computeStreak(null, '2026-07-02')).toBe(1)
  })
  it('consecutive day increments', () => {
    expect(computeStreak({ claim_date: '2026-07-01', streak: 4 }, '2026-07-02')).toBe(5)
  })
  it('a gap resets to 1', () => {
    expect(computeStreak({ claim_date: '2026-06-29', streak: 9 }, '2026-07-02')).toBe(1)
  })
  it('same-day prior claim (should not happen, UNIQUE guards) still resets sanely', () => {
    expect(computeStreak({ claim_date: '2026-07-02', streak: 3 }, '2026-07-02')).toBe(1)
  })
})

describe('buildDailyRewards', () => {
  it('streak 1 with a pack: pack + 2 gemme', () => {
    const r = buildDailyRewards(1, 'pk1')
    expect(r).toEqual([
      { type: 'bustina', payload: { pack_id: 'pk1', quantity: 1 } },
      { type: 'gemme', payload: { amount: 2 } },
    ])
  })
  it('no pack configured: gold fallback', () => {
    expect(buildDailyRewards(1, null)[0]).toEqual({ type: 'gold', payload: { amount: DAILY_FALLBACK_GOLD } })
  })
  it('gemme scale with streak, capped at 7', () => {
    expect(buildDailyRewards(3, 'pk1')[1].payload.amount).toBe(6)
    expect(buildDailyRewards(7, 'pk1')[1].payload.amount).toBe(14)
    expect(buildDailyRewards(30, 'pk1')[1].payload.amount).toBe(14)
  })
  it('every 7th day adds an extra pack (or gold fallback)', () => {
    expect(buildDailyRewards(7, 'pk1')).toHaveLength(3)
    expect(buildDailyRewards(14, null).at(-1)).toEqual({ type: 'gold', payload: { amount: DAILY_FALLBACK_GOLD * 2 } })
    expect(buildDailyRewards(8, 'pk1')).toHaveLength(2)
  })
})
