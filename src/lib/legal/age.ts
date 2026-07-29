import { MIN_AGE_WITHOUT_PARENT } from '@/lib/legal/controller'

/**
 * Age gate for sign-up.
 *
 * The `profiles.gdpr_consent_minor` column has existed since migration 006 and
 * was never read or written by anything — no age was ever collected. For a
 * geolocated game played outdoors by children, with Google login (13+) as the
 * only way in, that left the app with no lawful basis for a minor's data and no
 * record of parental consent.
 *
 * We ask for a birth YEAR, not a full date: it is enough to apply the threshold
 * and it is markedly less identifying. The year itself is never stored — only
 * the boolean outcome — which is what the privacy notice promises.
 */

/** Below this the app isn't appropriate at all, parental consent or not. */
export const ABSOLUTE_MIN_AGE = 6

export type AgeCheck =
  | { ok: true; isMinor: boolean }
  | { ok: false; reason: 'invalid' | 'too_young' | 'needs_parental_consent' }

/**
 * Age in years as of the end of the current calendar year, i.e. the most
 * generous reading of a bare birth year. Someone born in 2012 is treated as 14
 * for the whole of 2026 rather than being blocked until their birthday — with
 * only a year to go on, refusing the benefit of the doubt would gate people who
 * are in fact old enough.
 */
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return now.getFullYear() - birthYear
}

export function checkAge(
  birthYear: unknown,
  parentalConsent: boolean,
  now: Date = new Date(),
): AgeCheck {
  const year = Number(birthYear)
  const currentYear = now.getFullYear()

  if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
    return { ok: false, reason: 'invalid' }
  }

  const age = ageFromBirthYear(year, now)

  if (age < ABSOLUTE_MIN_AGE) return { ok: false, reason: 'too_young' }
  if (age >= MIN_AGE_WITHOUT_PARENT) return { ok: true, isMinor: false }

  // Under the digital-consent age: allowed only with a parent/guardian, who is
  // present at the event — this is a supervised, in-person product, which is
  // what makes an in-app declaration a reasonable mechanism here.
  return parentalConsent
    ? { ok: true, isMinor: true }
    : { ok: false, reason: 'needs_parental_consent' }
}

export const AGE_ERROR_MESSAGES: Record<Exclude<AgeCheck & { ok: false }, { ok: true }>['reason'], string> = {
  invalid: 'Inserisci un anno di nascita valido.',
  too_young: 'Questo gioco non è adatto a bambini di questa età.',
  needs_parental_consent: `Sotto i ${MIN_AGE_WITHOUT_PARENT} anni serve il consenso di un genitore o tutore presente all'evento.`,
}
