import { describe, expect, it } from 'vitest'
import {
  activeEventBonuses,
  eventBonusMultiplier,
  EVENT_BONUS_LIMITS,
  isEventBonusKind,
  parseEventBonuses,
  withEventBonus,
} from '@/lib/game/event-bonuses'

const NOW = Date.parse('2026-07-29T12:00:00Z')
const future = (min: number) => new Date(NOW + min * 60_000).toISOString()
const past = (min: number) => new Date(NOW - min * 60_000).toISOString()

describe('isEventBonusKind', () => {
  it('accepts the three real effects', () => {
    expect(isEventBonusKind('exp_boost')).toBe(true)
    expect(isEventBonusKind('gold_rain')).toBe(true)
    expect(isEventBonusKind('spawn_boost')).toBe(true)
  })

  // The admin form used to be free text, so old pins can carry anything.
  it('rejects legacy free-text event types', () => {
    expect(isEventBonusKind('doppia_esperienza')).toBe(false)
    expect(isEventBonusKind('')).toBe(false)
    expect(isEventBonusKind(42)).toBe(false)
  })
})

describe('parseEventBonuses', () => {
  it('returns an empty map for junk', () => {
    expect(parseEventBonuses(null)).toEqual({})
    expect(parseEventBonuses('nope')).toEqual({})
    expect(parseEventBonuses([1, 2])).toEqual({})
  })

  it('drops unknown kinds and malformed entries', () => {
    const parsed = parseEventBonuses({
      exp_boost: { mult: 2, until: future(10) },
      nonsense: { mult: 9, until: future(10) },
      gold_rain: { mult: 'x', until: future(10) },
      spawn_boost: { mult: 2, until: 'not-a-date' },
    })
    expect(Object.keys(parsed)).toEqual(['exp_boost'])
  })

  it('drops multipliers that would be a no-op or a nerf', () => {
    expect(parseEventBonuses({ exp_boost: { mult: 1, until: future(10) } })).toEqual({})
    expect(parseEventBonuses({ exp_boost: { mult: 0.5, until: future(10) } })).toEqual({})
  })
})

describe('eventBonusMultiplier', () => {
  it('is 1 with nothing stored', () => {
    expect(eventBonusMultiplier(null, 'exp_boost', NOW)).toBe(1)
    expect(eventBonusMultiplier({}, 'gold_rain', NOW)).toBe(1)
  })

  it('returns the multiplier while active', () => {
    const raw = { exp_boost: { mult: 2, until: future(5) } }
    expect(eventBonusMultiplier(raw, 'exp_boost', NOW)).toBe(2)
  })

  it('returns 1 once expired', () => {
    const raw = { exp_boost: { mult: 2, until: past(1) } }
    expect(eventBonusMultiplier(raw, 'exp_boost', NOW)).toBe(1)
  })

  it('does not leak between kinds', () => {
    const raw = { exp_boost: { mult: 3, until: future(5) } }
    expect(eventBonusMultiplier(raw, 'gold_rain', NOW)).toBe(1)
    expect(eventBonusMultiplier(raw, 'spawn_boost', NOW)).toBe(1)
  })
})

describe('withEventBonus', () => {
  it('stores a new bonus with the requested multiplier and expiry', () => {
    const next = withEventBonus(null, 'exp_boost', 2, 15, NOW)
    expect(next.exp_boost!.mult).toBe(2)
    expect(Date.parse(next.exp_boost!.until)).toBe(NOW + 15 * 60_000)
  })

  it('clamps absurd values so an admin typo cannot break an event', () => {
    const huge = withEventBonus(null, 'exp_boost', 1000, 100000, NOW)
    expect(huge.exp_boost!.mult).toBe(EVENT_BONUS_LIMITS.maxMultiplier)
    expect(Date.parse(huge.exp_boost!.until))
      .toBe(NOW + EVENT_BONUS_LIMITS.maxMinutes * 60_000)
  })

  it('ignores a multiplier of 1 or less (nothing to grant)', () => {
    expect(withEventBonus(null, 'exp_boost', 1, 15, NOW)).toEqual({})
  })

  // Picking up a second, weaker pin must not downgrade a running bonus, and a
  // stronger short one must not cut a weaker long one short.
  it('keeps the better multiplier and the later expiry when re-granted', () => {
    const first = withEventBonus(null, 'exp_boost', 3, 60, NOW)
    const second = withEventBonus(first, 'exp_boost', 2, 5, NOW)
    expect(second.exp_boost!.mult).toBe(3)
    expect(Date.parse(second.exp_boost!.until)).toBe(NOW + 60 * 60_000)
  })

  it('takes the stronger multiplier when re-granted higher', () => {
    const first = withEventBonus(null, 'gold_rain', 2, 10, NOW)
    const second = withEventBonus(first, 'gold_rain', 4, 5, NOW)
    expect(second.gold_rain!.mult).toBe(4)
    expect(Date.parse(second.gold_rain!.until)).toBe(NOW + 10 * 60_000)
  })

  it('an expired bonus is replaced outright, not merged', () => {
    const stale = { exp_boost: { mult: 5, until: past(10) } }
    const next = withEventBonus(stale, 'exp_boost', 2, 5, NOW)
    expect(next.exp_boost!.mult).toBe(2)
    expect(Date.parse(next.exp_boost!.until)).toBe(NOW + 5 * 60_000)
  })

  it('leaves other kinds untouched', () => {
    const first = withEventBonus(null, 'exp_boost', 2, 30, NOW)
    const second = withEventBonus(first, 'spawn_boost', 2, 10, NOW)
    expect(second.exp_boost!.mult).toBe(2)
    expect(second.spawn_boost!.mult).toBe(2)
  })
})

describe('activeEventBonuses', () => {
  it('lists only running bonuses, soonest to expire first', () => {
    const raw = {
      exp_boost: { mult: 2, until: future(30) },
      gold_rain: { mult: 2, until: future(5) },
      spawn_boost: { mult: 2, until: past(1) },
    }
    expect(activeEventBonuses(raw, NOW).map(b => b.kind)).toEqual(['gold_rain', 'exp_boost'])
  })

  it('is empty when nothing is running', () => {
    expect(activeEventBonuses({ exp_boost: { mult: 2, until: past(1) } }, NOW)).toEqual([])
  })
})
