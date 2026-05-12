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
