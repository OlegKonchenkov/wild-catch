// Single source of truth for the always-on tutorial session IDs.
// Mirrored in supabase/migrations/030_tutorial_session.sql (v1) and
// 031_tutorial_expansion.sql (v2). Change all three together.

export const TUTORIAL_SESSION_ID = '7470a101-d41d-0500-0000-000000000001'

export const TUTORIAL_ITEMS = {
  esca: '7470a17e-d41d-0500-0000-000000000110',
  rete: '7470a17e-d41d-0500-0000-000000000111',
} as const

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
  'duel_lineups',
] as const

// ── Backwards-compatible aliases ────────────────────────────────────────────
// Used by the v1 client code shipped in commit 50eb506. Kept as aliases so
// existing imports don't break.
export const TUTORIAL_ITEM_ID = TUTORIAL_ITEMS.esca
export const TUTORIAL_QR_ID   = TUTORIAL_QR_CODES.item
export const TUTORIAL_QR_CODE = TUTORIAL_QR_CODES.item
