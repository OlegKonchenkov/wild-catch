import { describe, expect, it } from 'vitest'
import { ABSOLUTE_MIN_AGE, ageFromBirthYear, checkAge } from '@/lib/legal/age'
import { MIN_AGE_WITHOUT_PARENT } from '@/lib/legal/controller'

const NOW = new Date('2026-07-29T12:00:00Z')
const bornAgo = (years: number) => NOW.getFullYear() - years

describe('MIN_AGE_WITHOUT_PARENT', () => {
  // Italy set the digital-consent age at 14 under GDPR art. 8
  // (Codice Privacy art. 2-quinquies). Lowering this is a legal decision.
  it('is the Italian digital consent age', () => {
    expect(MIN_AGE_WITHOUT_PARENT).toBe(14)
  })
})

describe('ageFromBirthYear', () => {
  // With only a year to go on, we give the benefit of the doubt: someone who
  // turns 14 later this year is not blocked until their birthday.
  it('treats the birth year as if the birthday has passed', () => {
    expect(ageFromBirthYear(2012, NOW)).toBe(14)
    expect(ageFromBirthYear(2026, NOW)).toBe(0)
  })
})

describe('checkAge', () => {
  it('accepts an adult without parental consent', () => {
    expect(checkAge(bornAgo(30), false, NOW)).toEqual({ ok: true, isMinor: false })
  })

  it('accepts exactly the consent age without a parent', () => {
    expect(checkAge(bornAgo(MIN_AGE_WITHOUT_PARENT), false, NOW))
      .toEqual({ ok: true, isMinor: false })
  })

  // The case the app had no handling for at all: gdpr_consent_minor existed in
  // the schema since migration 006 and was never written, because no age was
  // ever collected.
  it('requires parental consent just below the threshold', () => {
    const year = bornAgo(MIN_AGE_WITHOUT_PARENT - 1)
    expect(checkAge(year, false, NOW)).toEqual({ ok: false, reason: 'needs_parental_consent' })
    expect(checkAge(year, true, NOW)).toEqual({ ok: true, isMinor: true })
  })

  it('flags the minor outcome so it can be recorded', () => {
    const verdict = checkAge(bornAgo(10), true, NOW)
    expect(verdict).toEqual({ ok: true, isMinor: true })
  })

  it('refuses very young children even with parental consent', () => {
    expect(checkAge(bornAgo(ABSOLUTE_MIN_AGE - 1), true, NOW))
      .toEqual({ ok: false, reason: 'too_young' })
  })

  it.each([
    ['empty', ''],
    ['nonsense', 'abc'],
    ['future', 2030],
    ['prehistoric', 1800],
    ['fractional', 2010.5],
    ['missing', undefined],
    ['null', null],
  ])('rejects an invalid birth year (%s)', (_label, value) => {
    expect(checkAge(value, false, NOW)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('never returns ok for an unparseable year even with parental consent ticked', () => {
    expect(checkAge('', true, NOW).ok).toBe(false)
  })
})
