import { describe, it, expect } from 'vitest'
import { periodKeyFor, isoWeekKey } from '../recurrence'

describe('periodKeyFor', () => {
  const now = new Date('2026-07-02T10:00:00Z') // Rome: 2026-07-02 (CEST)

  it('one-shot missions map to the empty key (pre-existing rows)', () => {
    expect(periodKeyFor(null, now)).toBe('')
    expect(periodKeyFor(undefined, now)).toBe('')
  })
  it('daily = Rome date', () => {
    expect(periodKeyFor('daily', now)).toBe('2026-07-02')
    // 22:30 UTC crosses to the next Rome day in summer (CEST +2)
    expect(periodKeyFor('daily', new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02')
  })
  it('monthly = YYYY-MM', () => {
    expect(periodKeyFor('monthly', now)).toBe('2026-07')
  })
  it('weekly = ISO week', () => {
    expect(periodKeyFor('weekly', now)).toBe('2026-W27') // Jul 2 2026 is a Thursday of W27
  })
})

describe('isoWeekKey', () => {
  it('handles year boundaries per ISO 8601', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01') // Thu Jan 1 2026 → W01
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53') // Fri Jan 1 2027 belongs to ISO 2026
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01') // Mon Dec 30 2024 → ISO 2025 W01
  })
  it('mid-year sanity', () => {
    expect(isoWeekKey('2026-07-06')).toBe('2026-W28') // Monday after W27
  })
})
