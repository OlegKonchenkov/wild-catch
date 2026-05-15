// Pure step-counter / encounter-trigger validation extracted from
// /api/game/position so it can be unit-tested and reused.
//
// Goal: count only real walking, never GPS jitter. Industry-standard
// fitness filters reject fixes whose reported accuracy is comparable to
// or larger than the observed displacement — a "move" of 8 m with ±25 m
// accuracy is statistically noise, not a step.
//
// Tuning rationale (revised May 2026 after a step-counting audit):
// - ACCURACY_MAX_FOR_STEPS lowered 50 → 30 m. The 50 m bar credited
//   borderline fixes in dense buildings / under canopies where multi-
//   path errors can be 30-40 m. 30 m matches Strava/Garmin's outdoor
//   "usable" threshold.
// - STEP_SNR raised 0.8 → 1.0. The standard SNR rule of thumb in GPS
//   fitness apps is "credit ONLY when displacement ≥ accuracy" — i.e.
//   you've genuinely moved further than the noise circle. 0.8 was too
//   generous: at acc=30 it credited anything ≥ 24 m, swallowing real
//   GPS drift.
// - MIN_SPEED_MPS added (new). When you stand still, GPS may slowly
//   drift to fool the SNR check across enough fixes. A minimum implied
//   speed of 0.3 m/s (~1 km/h, less than a strolling pace) catches
//   "I'm sitting on a bench" drift that would otherwise sneak through.

export const STEP_FILTER = {
  /** Reject fixes coarser than this for step credit (m). */
  ACCURACY_MAX_FOR_STEPS: 30,
  /** Don't refresh the saved baseline when accuracy is worse than this (m). */
  ACCURACY_MAX_FOR_BASELINE: 100,
  /** Minimum credible displacement to consider as movement (m). */
  STEP_MIN_M: 3,
  /** Hard upper bound on a single interval to reject GPS spikes (m). */
  STEP_MAX_M: 100,
  /** Distance must exceed (SNR × accuracy) to count as a step. */
  STEP_SNR: 1.0,
  /** Implied velocity must be ≥ this in m/s — under 0.3 m/s is stationary drift, not walking. */
  MIN_SPEED_MPS: 0.3,
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
  const impliedSpeedMps = elapsedMs ? distanceMoved / (elapsedMs / 1000) : null
  // When we have no elapsed time (first fix), we trust the SNR + distance
  // checks alone — no speed gate. Otherwise BOTH bounds apply: too slow
  // → stationary drift; too fast → GPS spike / impossible movement.
  const speedOk =
    impliedSpeedMps === null ||
    (impliedSpeedMps >= F.MIN_SPEED_MPS && impliedSpeedMps <= F.MAX_SPEED_MPS)

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

// ── Position smoothing & stationary detection ──────────────────────────────
// Industry GPS fitness apps don't trust a single raw fix for distance —
// they smooth across N samples (Kalman, Madgwick, or simple EMA) to damp
// jitter-induced zigzag overcount. For a 1Hz PWA we use the cheapest
// effective option: an adaptive exponential moving average where alpha
// scales with reported accuracy (good fix → trust new sample more).

export interface SmoothedPosition {
  lat: number
  lng: number
  accuracy: number
}

/**
 * Blend a raw GPS fix into an existing smoothed position using EMA.
 *
 * Weight calculation: `α = 20 / (20 + accuracy)` clamped to [0.2, 0.85].
 *   - Accuracy = 5 m (great) → α ≈ 0.80 → smoothed ≈ new fix
 *   - Accuracy = 20 m (ok)   → α = 0.50 → 50/50 blend
 *   - Accuracy = 50 m (bad)  → α ≈ 0.29 → smoothed barely moves
 *
 * The clamp keeps the filter responsive (never < 0.2 → can still drift to
 * follow real movement) and stable (never > 0.85 → always some history
 * smoothing). 20 m is the pivot because it's roughly the "good urban
 * outdoor" GPS accuracy threshold.
 *
 * Returns the new smoothed position. Resulting accuracy is the geometric
 * mean of old and new, which is conservative — it makes downstream filters
 * a touch stricter as confidence improves.
 */
export function smoothPosition(
  previous: SmoothedPosition | null,
  raw: { lat: number; lng: number; accuracy: number },
): SmoothedPosition {
  if (!previous) return { lat: raw.lat, lng: raw.lng, accuracy: raw.accuracy }
  const acc = Math.max(1, raw.accuracy)
  const alpha = Math.max(0.2, Math.min(0.85, 20 / (20 + acc)))
  return {
    lat: previous.lat * (1 - alpha) + raw.lat * alpha,
    lng: previous.lng * (1 - alpha) + raw.lng * alpha,
    // Geometric mean — a bit conservative; reflects "we trust the smoothed
    // position more than the raw worst-case but not more than the best".
    accuracy: Math.sqrt(Math.max(1, previous.accuracy) * acc),
  }
}

/**
 * Detect whether the last N fixes represent the user being stationary —
 * the device sitting on a table, in a pocket while waiting at a bus stop,
 * etc. — so the caller can silently reset its movement baseline and avoid
 * the slow accumulation of drift across many fixes that would eventually
 * cross the credit threshold.
 *
 * Heuristic: every pairwise distance among the last N fixes must be
 * within `max(2, avgAccuracy / 2)` metres. Two metres is a hard floor so
 * we don't false-positive a real slow walker whose strides are tight.
 *
 * Returns true when:
 *   - We have at least 3 samples
 *   - The diameter of the sample cluster is under the threshold
 *
 * The window size and threshold are intentionally simple — Kalman would
 * be better but overkill for a once-a-second feed.
 */
const STATIONARY_MIN_FLOOR_M = 2

export function isStationary(
  fixes: ReadonlyArray<{ lat: number; lng: number; accuracy: number }>,
): boolean {
  if (fixes.length < 3) return false
  const avgAccuracy = fixes.reduce((s, f) => s + f.accuracy, 0) / fixes.length
  const threshold = Math.max(STATIONARY_MIN_FLOOR_M, avgAccuracy / 2)
  // O(n²) but n is small (3-5) — clearer than tracking running centroid.
  for (let i = 0; i < fixes.length; i++) {
    for (let j = i + 1; j < fixes.length; j++) {
      if (haversine(fixes[i], fixes[j]) > threshold) return false
    }
  }
  return true
}

/**
 * Sliding-window helper that takes a previous list of recent fixes plus
 * a new one and returns the next window (max length `windowSize`,
 * newest-last). Pure / no mutation.
 */
export function pushRecentFix<T>(window: ReadonlyArray<T>, next: T, windowSize: number): T[] {
  const capped = Math.max(1, windowSize)
  if (capped === 1) return [next]
  return [...window.slice(-(capped - 1)), next]
}

// Local haversine — duplicates anti-cheat.ts to keep step-counter dependency-free.
// Returns metres between two lat/lng points.
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
