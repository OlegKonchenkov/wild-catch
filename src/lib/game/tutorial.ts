// Single source of truth for the always-on tutorial session IDs.
// Mirrored in supabase/migrations/030_tutorial_session.sql — change both.

export const TUTORIAL_SESSION_ID = '7470a101-d41d-0500-0000-000000000001'
export const TUTORIAL_ITEM_ID    = '7470a17e-d41d-0500-0000-000000000101'
export const TUTORIAL_QR_ID      = '7470a1c0-d41d-0500-0000-000000000201'
export const TUTORIAL_QR_CODE    = 'TUTOR1'

export const TUTORIAL_MISSION_IDS = {
  primiPassi:          '7470a311-d41d-0500-0000-000000000301',
  primoIncontro:       '7470a311-d41d-0500-0000-000000000302',
  segnoNelTerritorio:  '7470a311-d41d-0500-0000-000000000303',
  apprendistaCompleto: '7470a311-d41d-0500-0000-000000000304',
} as const

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
