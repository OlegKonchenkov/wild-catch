// Single source of truth for the always-on tutorial session IDs.
// Mirrored in supabase/migrations/030_tutorial_session.sql (v1) and
// 031_tutorial_expansion.sql (v2). Change all three together.

export const TUTORIAL_SESSION_ID = '7470a101-d41d-0500-0000-000000000001'

/** True when the given session id is the always-on tutorial session.
 *  Used by query builders to decide whether to include "global" rows
 *  (session_id IS NULL): in real events we want both event-scoped +
 *  globals; in the tutorial we want a clean, isolated catalogue with
 *  no leaks from globally-defined missions / items / QRs / enigmi. */
export function isTutorialSession(sessionId: string | null | undefined): boolean {
  return sessionId === TUTORIAL_SESSION_ID
}

/** PostgREST `.or()` filter string for "this session OR global".
 *  For tutorial sessions we return null so the caller can fall back to
 *  a plain `.eq('session_id', sid)` — keeping the tutorial catalogue
 *  isolated. */
export function scopedSessionOrFilter(sessionId: string): string | null {
  if (isTutorialSession(sessionId)) return null
  return `session_id.eq.${sessionId},session_id.is.null`
}

export const TUTORIAL_ITEMS = {
  esca: '7470a17e-d41d-0500-0000-000000000110',
  rete: '7470a17e-d41d-0500-0000-000000000111',
} as const

/** Tutorial enigma — "anima". Mirrors migration 032. */
export const TUTORIAL_ENIGMA_ID = '7470a4e1-d41d-0500-0000-000000000501'

export const TUTORIAL_FRAMMENTI = {
  /** Granted on mission 2 completion (first catch). */
  respiro: '7470a4f2-d41d-0500-0000-000000000601',
  /** Granted on mission 5 completion (boss QR). */
  eco:     '7470a4f2-d41d-0500-0000-000000000602',
} as const

/** Granted on tutorial start (the "free hint" the user mentioned). */
export const TUTORIAL_SUGGERIMENTO_ID = '7470a503-d41d-0500-0000-000000000701'

/** Granted on claim of the tutorial map pin (must walk to it).
 *  Migration 033 seed. */
export const TUTORIAL_BONUS_SUGGERIMENTO_ID = '7470a503-d41d-0500-0000-000000000702'

/** Distance from the player's first GPS fix where the tutorial bonus pin
 *  is dropped (metres). 40m is ≈ 30–50 s of slow walking — far enough to
 *  feel like a real objective, close enough that even fragile GPS gets
 *  there within a tutorial session. */
export const TUTORIAL_PIN_OFFSET_M = 40

/** Distance below which the bonus pin auto-claims (metres). */
export const TUTORIAL_PIN_CLAIM_RADIUS_M = 25

/** Mapping: when a mission id completes, grant this frammento. */
export const TUTORIAL_MISSION_FRAMMENTO_GRANTS: Record<string, string> = {
  '7470a311-d41d-0500-0000-000000000402': TUTORIAL_FRAMMENTI.respiro,
  '7470a311-d41d-0500-0000-000000000405': TUTORIAL_FRAMMENTI.eco,
}

/** Manual codes are what the simulated-scan button passes to /api/game/qr/scan. */
export const TUTORIAL_QR_CODES = {
  /** First simulated scan — awards the Esca del Tirocinante. Mission 3. */
  item: 'TUTOR1',
  /** Second simulated scan — triggers the Capo del Tirocinio boss fight. Mission 5. */
  boss: 'TUTBSS',
} as const

/** True if a mission target string refers to a tutorial QR (item or boss). */
export function isTutorialQrTarget(target: string | null | undefined): boolean {
  if (!target) return false
  return target === TUTORIAL_QR_CODES.item || target === TUTORIAL_QR_CODES.boss
}

/** Friendly button label for the simulated QR scan, based on which target is active. */
export function tutorialQrButtonLabel(target: string | null | undefined): string {
  if (target === TUTORIAL_QR_CODES.boss) return '💀 Evoca il Capo del Tirocinio'
  return '🪄 Simula scansione QR'
}

/** Tables that hold per-(user, session) state. Used by the tutorial reset
 *  helper to wipe a player's tutorial run cleanly so they can replay. */
export const TUTORIAL_USER_SESSION_TABLES = [
  'player_creatures',
  'player_inventory',
  'player_eggs',
  'player_missions',
  'encounters',
  'boss_fights',
  'pin_claims',
  'qr_scan_log',
  'player_enigma_suggerimenti',
  'player_enigma_frammenti',
  'player_enigmi',
  'duel_lineups',
] as const

/** Derive a deterministic bearing 0–359° from a user UUID. Same user
 *  always sees the pin in the same direction across reloads / devices —
 *  but different users see different directions, so the tutorial doesn't
 *  always send people the same way (which would be obvious & gameable). */
export function tutorialPinBearingForUser(userId: string): number {
  // djb2-style hash on the UUID string. Plenty random for direction-only.
  let h = 5381
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) + h + userId.charCodeAt(i)) >>> 0
  }
  return h % 360
}

/** Walk N metres along a bearing from a GPS anchor. Local equirectangular
 *  approximation — fine for the tutorial-scale offset (~40 m). */
export function offsetGpsPoint(
  anchor: { lat: number; lng: number },
  bearingDeg: number,
  distanceM: number,
): { lat: number; lng: number } {
  const rad = (bearingDeg * Math.PI) / 180
  const dLat = (distanceM * Math.cos(rad)) / 111_111
  const cosLat = Math.cos((anchor.lat * Math.PI) / 180)
  const dLng = cosLat === 0
    ? 0
    : (distanceM * Math.sin(rad)) / (111_111 * cosLat)
  return { lat: anchor.lat + dLat, lng: anchor.lng + dLng }
}

// ── Backwards-compatible aliases ────────────────────────────────────────────
// Used by the v1 client code shipped in commit 50eb506. Kept as aliases so
// existing imports don't break.
export const TUTORIAL_ITEM_ID = TUTORIAL_ITEMS.esca
export const TUTORIAL_QR_ID   = TUTORIAL_QR_CODES.item
export const TUTORIAL_QR_CODE = TUTORIAL_QR_CODES.item
