/**
 * Timed session-wide bonuses granted by an `evento` reward (map pin or QR).
 *
 * The reward type has existed since the loot dispenser was written and has
 * always been a no-op: `dispenseReward`'s `case 'evento'` echoed the payload
 * back to the client (`{ eventType, effect }`) and nothing else. The admin form
 * was a free-text box whose placeholder suggested "spawn_boost, gold_rain…", so
 * an organiser could author an event bonus, the player would see a nice message
 * and receive precisely nothing.
 *
 * This module is the contract that was missing: a fixed set of effects, each
 * with a multiplier and an expiry, stored on `player_sessions.event_bonuses`.
 */

/** Effects an `evento` reward can grant. */
export const EVENT_BONUS_KINDS = ['exp_boost', 'gold_rain', 'spawn_boost'] as const
export type EventBonusKind = (typeof EVENT_BONUS_KINDS)[number]

export const EVENT_BONUS_LABELS: Record<EventBonusKind, string> = {
  exp_boost:   'EXP potenziata',
  gold_rain:   'Pioggia d\'oro',
  spawn_boost: 'Richiamo selvaggio',
}

/** Guard rails so a typo in the admin form can't grant a ×1000 for a week. */
export const EVENT_BONUS_LIMITS = {
  minMultiplier: 1,
  maxMultiplier: 5,
  minMinutes: 1,
  maxMinutes: 180,
} as const

interface StoredBonus {
  mult: number
  until: string
}

export type EventBonusMap = Partial<Record<EventBonusKind, StoredBonus>>

function isKind(value: unknown): value is EventBonusKind {
  return typeof value === 'string' && (EVENT_BONUS_KINDS as readonly string[]).includes(value)
}

/** Public guard — lets the dispenser tell a real effect from legacy free text. */
export const isEventBonusKind = isKind

/** Read the JSONB column defensively — it is player-visible state, not a schema. */
export function parseEventBonuses(raw: unknown): EventBonusMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: EventBonusMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isKind(key) || !value || typeof value !== 'object') continue
    const { mult, until } = value as Record<string, unknown>
    const m = Number(mult)
    if (!Number.isFinite(m) || m <= 1) continue
    if (typeof until !== 'string' || !Number.isFinite(Date.parse(until))) continue
    out[key] = { mult: m, until }
  }
  return out
}

/**
 * Multiplier currently in effect for `kind`, or 1 when there is none.
 * Expired entries are simply ignored — no cleanup pass needed, they get
 * overwritten the next time the same bonus is granted.
 */
export function eventBonusMultiplier(
  raw: unknown,
  kind: EventBonusKind,
  now: number = Date.now(),
): number {
  const entry = parseEventBonuses(raw)[kind]
  if (!entry) return 1
  return Date.parse(entry.until) > now ? entry.mult : 1
}

/** Bonuses still running, for the HUD. Sorted by soonest to expire. */
export function activeEventBonuses(
  raw: unknown,
  now: number = Date.now(),
): Array<{ kind: EventBonusKind; mult: number; until: string }> {
  return Object.entries(parseEventBonuses(raw))
    .map(([kind, entry]) => ({ kind: kind as EventBonusKind, ...entry! }))
    .filter(b => Date.parse(b.until) > now)
    .sort((a, b) => Date.parse(a.until) - Date.parse(b.until))
}

/**
 * Merge a newly granted bonus into the stored map.
 *
 * Re-granting the same kind takes the more generous outcome on each axis
 * independently: the higher multiplier, and the later expiry. Picking up a
 * second ×2 pin shouldn't downgrade a running ×3, and a stronger short bonus
 * shouldn't cut short a weaker long one.
 */
export function withEventBonus(
  raw: unknown,
  kind: EventBonusKind,
  multiplier: number,
  minutes: number,
  now: number = Date.now(),
): EventBonusMap {
  const { minMultiplier, maxMultiplier, minMinutes, maxMinutes } = EVENT_BONUS_LIMITS
  const mult = Math.min(maxMultiplier, Math.max(minMultiplier, Number(multiplier) || 1))
  const mins = Math.min(maxMinutes, Math.max(minMinutes, Math.round(Number(minutes) || 0)))
  if (mult <= 1) return parseEventBonuses(raw)

  const current = parseEventBonuses(raw)
  const existing = current[kind]
  const existingActive = existing && Date.parse(existing.until) > now ? existing : null
  const untilMs = now + mins * 60_000

  current[kind] = {
    mult: Math.max(mult, existingActive?.mult ?? 0),
    until: new Date(Math.max(untilMs, existingActive ? Date.parse(existingActive.until) : 0)).toISOString(),
  }
  return current
}
