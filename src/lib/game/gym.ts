/**
 * Capipalestra presidiabili — logica pura (Wave 2 / Territorio Vivo).
 *
 * Un presidio fresco difende forte; col passare delle ore la difesa decade,
 * così le palestre stantie possono cadere. La rendita matura mentre si
 * presidia e viene consegnata allo spodestato. Tutto calcolato da held_since,
 * nessun cron.
 */

/** Bonus difesa a presidio fresco (+25% alle stats della lineup). */
export const GYM_FRESH_DEFENSE = 0.25
/** Decadimento della difesa per ora di presidio. */
export const GYM_DECAY_PER_HOUR = 0.05
/** Pavimento del malus (−20%): una palestra vecchia è vulnerabile ma non inerme. */
export const GYM_DEFENSE_FLOOR = -0.20
/** Rendita oro per ora di presidio, consegnata allo spodestato. */
export const GYM_GOLD_PER_HOUR = 10
/** Tetto della rendita (24 h utili). */
export const GYM_GOLD_CAP = 240

export function heldHours(heldSinceIso: string, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(heldSinceIso).getTime()
  return Math.max(0, ms / 3_600_000)
}

/**
 * Moltiplicatore stats della lineup boss di una palestra presidiata.
 * Nessun presidio → 1 (stats base). Fresca → ×1.25; −5%/h fino a ×0.80.
 */
export function gymDefenseMultiplier(heldSinceIso: string | null, now: Date = new Date()): number {
  if (!heldSinceIso) return 1
  const bonus = GYM_FRESH_DEFENSE - GYM_DECAY_PER_HOUR * heldHours(heldSinceIso, now)
  return 1 + Math.max(GYM_DEFENSE_FLOOR, bonus)
}

/** Oro maturato dal presidio (consegnato allo spodestato alla caduta). */
export function gymAccruedGold(heldSinceIso: string, now: Date = new Date()): number {
  return Math.min(GYM_GOLD_CAP, Math.floor(heldHours(heldSinceIso, now) * GYM_GOLD_PER_HOUR))
}
