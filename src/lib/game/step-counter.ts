// Pure step-counter / encounter-trigger validation extracted from
// /api/game/position so it can be unit-tested and reused.
//
// Goal: count only real walking, never GPS jitter. Industry-standard
// fitness filters reject fixes whose reported accuracy is comparable to
// or larger than the observed displacement — a "move" of 8 m with ±25 m
// accuracy is statistically noise, not a step.

export const STEP_FILTER = {
  /** Reject fixes coarser than this for step credit (m). */
  ACCURACY_MAX_FOR_STEPS: 50,
  /** Don't refresh the saved baseline when accuracy is worse than this (m). */
  ACCURACY_MAX_FOR_BASELINE: 100,
  /** Minimum credible displacement to consider as movement (m). */
  STEP_MIN_M: 3,
  /** Hard upper bound on a single interval to reject GPS spikes (m). */
  STEP_MAX_M: 100,
  /** Distance must exceed (SNR × accuracy) to count as a step. */
  STEP_SNR: 0.8,
  /** Implied velocity must be ≤ this in m/s (≈14.4 km/h running upper bound). */
  MAX_SPEED_MPS: 4,
  /** Distance ≥ this credit triggers encounter rolls. */
  ENCOUNTER_MIN_M: 5,
} as const

export interface StepFilterInput {
  /** Distance from previously persisted baseline to the new fix (m). */
  distanceMoved: number
  /** Reported GPS accuracy of the new fix (m). Pass Infinity if unknown. */
  accuracy: number
  /** ms between previous persisted fix and now. null = no prior timestamp. */
  elapsedMs: number | null
  /** Session must be 'active' to accumulate steps — 'ready' is pre-start. */
  sessionStatus: string
  /** Player must be inside the session bounds. */
  inBounds: boolean
}

export interface StepFilterResult {
  /** True when the fix counts as real walking. */
  validStep: boolean
  /** Whole-metre step credit (0 when !validStep). */
  stepsIncrement: number
  /** Should the persisted baseline (last_position, last_position_at) be refreshed? */
  shouldUpdateBaseline: boolean
}

export function evaluateStep(input: StepFilterInput): StepFilterResult {
  const { distanceMoved, accuracy, elapsedMs, sessionStatus, inBounds } = input
  const F = STEP_FILTER

  const acc = Number.isFinite(accuracy) ? accuracy : Infinity
  const impliedSpeedMps = elapsedMs ? distanceMoved / (elapsedMs / 1000) : 0
  const speedOk = !elapsedMs || impliedSpeedMps <= F.MAX_SPEED_MPS

  const validStep =
    sessionStatus === 'active' &&
    inBounds &&
    acc <= F.ACCURACY_MAX_FOR_STEPS &&
    distanceMoved >= F.STEP_MIN_M &&
    distanceMoved <= F.STEP_MAX_M &&
    distanceMoved > acc * F.STEP_SNR &&
    speedOk

  return {
    validStep,
    stepsIncrement: validStep ? Math.round(distanceMoved) : 0,
    shouldUpdateBaseline: acc <= F.ACCURACY_MAX_FOR_BASELINE,
  }
}

/** True when this fix should also roll for a random encounter. */
export function shouldRollEncounter(result: StepFilterResult, distanceMoved: number): boolean {
  return result.validStep && distanceMoved >= STEP_FILTER.ENCOUNTER_MIN_M
}

/**
 * Fraction of the SNR threshold the optimistic "pending" display is allowed
 * to climb to before plateauing. Set just under 1 so the visible counter
 * never crosses the credit boundary — when the credit DOES fire, the new
 * committed total absorbs the pending without snapping the display backward.
 */
const PENDING_CAP_FRACTION = 0.85

/**
 * Monotonic-max accumulator for the "pending distance" the player has
 * covered since the last credit. Used by the map HUD to tick the step
 * counter forward every GPS fix instead of only when a credit fires.
 *
 * - `distanceMoved` is the haversine distance from the last committed
 *   baseline (the position where the previous credit fired or the server
 *   last reconciled).
 * - `accuracy` is the current fix's reported GPS accuracy in metres.
 *
 * Returns the new pending value, capped below the credit threshold. The
 * monotonic-max behaviour (`max(previous, …)`) prevents sub-fix GPS noise
 * from making the visible counter flicker downward — if the player walks
 * to d=8 m and the next fix reports d=6 m (jitter), pending stays at 8 m.
 *
 * Edge cases:
 * - accuracy = 0 or negative → cap is 0 → pending never grows. Safe.
 * - distanceMoved < 0 → clamped via `Math.min(...)` not increasing pending.
 */
export function updatePendingDistance(input: {
  previousPending: number
  distanceMoved: number
  accuracy: number
}): number {
  const { previousPending, distanceMoved, accuracy } = input
  const snrThreshold = Math.max(0, accuracy * STEP_FILTER.STEP_SNR)
  const cap = snrThreshold * PENDING_CAP_FRACTION
  const candidate = Math.min(Math.max(0, distanceMoved), cap)
  return Math.max(previousPending, candidate)
}
