/**
 * Single source of truth for the data controller / publisher identity.
 *
 * It used to be duplicated inside PrivacyPolicyModal as local consts, which is
 * fine until a second surface needs it — and a public /privacy page, a /termini
 * page and the app store listings all do. Two copies of a legal identity that
 * disagree is a compliance problem, not a tidiness one.
 *
 * The NEXT_PUBLIC_PRIVACY_* env vars still win when set, so an organiser running
 * their own instance can override without a code change.
 */
export const LEGAL = {
  businessName: 'Adventura Escape Room Pesaro di Marco Tomasucci',
  controllerName: 'Marco Tomasucci',
  address: 'Via XXIV Maggio 17, 61121 Pesaro (PU) — Italia',
  vatNumber: '02812540413',
  email: 'adventuraescaperoom@gmail.com',
  phone: '+39 339 7136398',
  appName: 'Daimon',
} as const

export function resolveController(overrideName?: string | null, overrideEmail?: string | null) {
  return {
    ...LEGAL,
    controllerName: overrideName?.trim() || LEGAL.controllerName,
    email: overrideEmail?.trim() || LEGAL.email,
  }
}

/** Last substantive revision. Shown on the public pages so a reader can tell
 *  which version they agreed to. Bump when the text changes. */
export const LEGAL_LAST_UPDATED = '2026-07-29'

/**
 * Minimum age to use the app without verified parental consent.
 *
 * Italy set the digital-consent age at 14 under GDPR art. 8 (Codice Privacy
 * art. 2-quinquies), which is the floor the age gate enforces.
 */
export const MIN_AGE_WITHOUT_PARENT = 14
