import { describe, it, expect } from 'vitest'
import {
  evaluateStep,
  shouldRollEncounter,
  STEP_FILTER,
  updatePendingDistance,
  smoothPosition,
  isStationary,
  pushRecentFix,
} from '@/lib/game/step-counter'

/**
 * Contract tests for the GPS step filter. These nail down the anti-jitter
 * behaviour described in 028_last_position_at + the position route comments.
 * Each case represents a real-world scenario we want the filter to handle.
 *
 * Tuning revision May 2026:
 *   - MIN_SPEED_MPS: NEW (≥ 0.3 required) — kept.
 *   - SNR 0.8→1.0 and accuracy 50→30 were reverted after a field test
 *     showed real walking no longer credited in proportion to movement.
 *   - EMA smoothing + stationary detection helpers still exist (and are
 *     tested) but are NOT wired into the live pipeline.
 * Tests below reflect the proven (reverted) gates: SNR 0.8, acc 50.
 */

const baseInput = {
  distanceMoved: 10,
  accuracy: 10,
  elapsedMs: 5000,        // a typical 5 s post interval
  sessionStatus: 'active',
  inBounds: true,
} as const

describe('evaluateStep', () => {
  describe('happy path', () => {
    it('accepts a clean walking fix', () => {
      // 8 m in 5 s with 6 m accuracy: dist > 1.0×acc, speed = 1.6 m/s
      const r = evaluateStep({ ...baseInput, distanceMoved: 8, accuracy: 6 })
      expect(r.validStep).toBe(true)
      expect(r.stepsIncrement).toBe(8)
      expect(r.shouldUpdateBaseline).toBe(true)
    })

    it('rounds fractional metres', () => {
      // 7.4 m in 5 s with 5 m accuracy: dist > acc, speed = 1.48 m/s
      const r = evaluateStep({ ...baseInput, distanceMoved: 7.4, accuracy: 5 })
      expect(r.stepsIncrement).toBe(7)
    })
  })

  describe('SNR (signal-to-noise) filter', () => {
    it('rejects a "move" smaller than 0.8 × accuracy (stationary GPS jitter)', () => {
      // User standing still, GPS 30 m accuracy, drifts 10 m. 10 < 24 → reject.
      const r = evaluateStep({ ...baseInput, distanceMoved: 10, accuracy: 30 })
      expect(r.validStep).toBe(false)
      expect(r.stepsIncrement).toBe(0)
    })

    it('accepts a move just above the SNR threshold', () => {
      // 0.8 × 10 = 8. Distance 9 > 8 → valid.
      const r = evaluateStep({ ...baseInput, distanceMoved: 9, accuracy: 10 })
      expect(r.validStep).toBe(true)
    })
  })

  describe('accuracy ceiling', () => {
    it('rejects fixes with accuracy worse than 50 m for step credit', () => {
      const r = evaluateStep({ ...baseInput, distanceMoved: 60, accuracy: 60 })
      expect(r.validStep).toBe(false)
    })

    it('still allows baseline refresh while accuracy ≤ 100 m', () => {
      const r = evaluateStep({ ...baseInput, distanceMoved: 60, accuracy: 80 })
      expect(r.validStep).toBe(false)        // no step credit
      expect(r.shouldUpdateBaseline).toBe(true)  // but baseline refreshes
    })

    it('skips baseline refresh on a wildly inaccurate fix', () => {
      const r = evaluateStep({ ...baseInput, distanceMoved: 200, accuracy: 250 })
      expect(r.shouldUpdateBaseline).toBe(false)
    })
  })

  describe('distance bounds', () => {
    it('rejects sub-jitter movement (< 3 m)', () => {
      const r = evaluateStep({ ...baseInput, distanceMoved: 2, accuracy: 1 })
      expect(r.validStep).toBe(false)
    })

    it('rejects spike (> 100 m in one interval)', () => {
      const r = evaluateStep({ ...baseInput, distanceMoved: 120, accuracy: 10 })
      expect(r.validStep).toBe(false)
    })
  })

  describe('velocity gate', () => {
    it('rejects when implied speed exceeds 4 m/s (running cap)', () => {
      // 50 m in 5 s = 10 m/s = 36 km/h
      const r = evaluateStep({ ...baseInput, distanceMoved: 50, accuracy: 10, elapsedMs: 5000 })
      expect(r.validStep).toBe(false)
    })

    it('rejects when implied speed is below 0.3 m/s (stationary drift)', () => {
      // 4 m in 30 s = 0.133 m/s. Distance passes SNR and min-distance,
      // but the slow implied speed flags it as drift.
      const r = evaluateStep({ ...baseInput, distanceMoved: 4, accuracy: 3, elapsedMs: 30000 })
      expect(r.validStep).toBe(false)
    })

    it('accepts a slow run at 3 m/s', () => {
      // 15 m in 5 s = 3 m/s = 10.8 km/h
      const r = evaluateStep({ ...baseInput, distanceMoved: 15, accuracy: 10, elapsedMs: 5000 })
      expect(r.validStep).toBe(true)
    })

    it('accepts a relaxed walk at ~1 m/s', () => {
      // 5 m in 5 s = 1.0 m/s = 3.6 km/h
      const r = evaluateStep({ ...baseInput, distanceMoved: 5, accuracy: 3, elapsedMs: 5000 })
      expect(r.validStep).toBe(true)
    })

    it('skips velocity check when no elapsed time is known (first fix)', () => {
      // 11 m with acc=6, SNR-passing, no elapsedMs → speed gate skipped
      const r = evaluateStep({ ...baseInput, distanceMoved: 11, accuracy: 6, elapsedMs: null })
      expect(r.validStep).toBe(true)
    })
  })

  describe('session gating', () => {
    it('rejects steps while session is "ready" (pre-start lobby)', () => {
      const r = evaluateStep({ ...baseInput, sessionStatus: 'ready', distanceMoved: 11, accuracy: 5 })
      expect(r.validStep).toBe(false)
    })

    it('rejects steps while session is "ended"', () => {
      const r = evaluateStep({ ...baseInput, sessionStatus: 'ended', distanceMoved: 11, accuracy: 5 })
      expect(r.validStep).toBe(false)
    })

    it('rejects steps when player is out of bounds', () => {
      const r = evaluateStep({ ...baseInput, inBounds: false, distanceMoved: 11, accuracy: 5 })
      expect(r.validStep).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles missing accuracy (Infinity) by rejecting', () => {
      const r = evaluateStep({ ...baseInput, distanceMoved: 10, accuracy: Infinity })
      expect(r.validStep).toBe(false)
    })

    it('exposes the configured constants for downstream callers', () => {
      expect(STEP_FILTER.ACCURACY_MAX_FOR_STEPS).toBe(50)
      expect(STEP_FILTER.STEP_SNR).toBe(0.8)
      expect(STEP_FILTER.MAX_SPEED_MPS).toBe(4)
      expect(STEP_FILTER.MIN_SPEED_MPS).toBe(0.3)
    })
  })
})

describe('shouldRollEncounter', () => {
  it('only rolls when the step is valid', () => {
    const invalid = { validStep: false, stepsIncrement: 0, shouldUpdateBaseline: true }
    expect(shouldRollEncounter(invalid, 50)).toBe(false)
  })

  it('only rolls when distance ≥ ENCOUNTER_MIN_M', () => {
    const valid = { validStep: true, stepsIncrement: 4, shouldUpdateBaseline: true }
    expect(shouldRollEncounter(valid, 4)).toBe(false)
    expect(shouldRollEncounter(valid, STEP_FILTER.ENCOUNTER_MIN_M)).toBe(true)
  })
})

describe('updatePendingDistance', () => {
  // Cap = accuracy * STEP_SNR (0.8) * 0.85.
  // With accuracy = 15 m: snrThreshold = 12, cap = 10.2.
  // With accuracy = 10 m: snrThreshold = 8,  cap = 6.8.

  it('grows monotonically with distance when below the cap', () => {
    let p = 0
    p = updatePendingDistance({ previousPending: p, distanceMoved: 1.5, accuracy: 15 })
    expect(p).toBe(1.5)
    p = updatePendingDistance({ previousPending: p, distanceMoved: 3.2, accuracy: 15 })
    expect(p).toBe(3.2)
    p = updatePendingDistance({ previousPending: p, distanceMoved: 9.0, accuracy: 15 })
    expect(p).toBe(9.0)
  })

  it('never decreases when distanceMoved shrinks (monotonic-max guards flicker)', () => {
    let p = updatePendingDistance({ previousPending: 0, distanceMoved: 8, accuracy: 15 })
    expect(p).toBe(8)
    // A subsequent GPS fix reports a smaller distance (jitter or back-step):
    // pending must hold its previous high so the visible counter doesn't tick backward.
    p = updatePendingDistance({ previousPending: p, distanceMoved: 5, accuracy: 15 })
    expect(p).toBe(8)
    p = updatePendingDistance({ previousPending: p, distanceMoved: 2, accuracy: 15 })
    expect(p).toBe(8)
  })

  it('caps just below the credit threshold so display does not cross it', () => {
    // Cap at accuracy=15: 15 * 0.8 * 0.85 = 10.2.
    const p1 = updatePendingDistance({ previousPending: 0, distanceMoved: 13, accuracy: 15 })
    expect(p1).toBeCloseTo(10.2, 5)
    const p2 = updatePendingDistance({ previousPending: 0, distanceMoved: 100, accuracy: 15 })
    expect(p2).toBeCloseTo(10.2, 5)
  })

  it('cap scales with accuracy — worse fixes can show more pending before credit', () => {
    // Better GPS (smaller accuracy) → tighter cap.
    const tight = updatePendingDistance({ previousPending: 0, distanceMoved: 50, accuracy: 10 })
    const loose = updatePendingDistance({ previousPending: 0, distanceMoved: 50, accuracy: 30 })
    expect(tight).toBeLessThan(loose)
    expect(tight).toBeCloseTo(10 * 0.8 * 0.85, 5) // 6.8
    expect(loose).toBeCloseTo(30 * 0.8 * 0.85, 5) // 20.4
  })

  it('clamps negative or zero accuracy to a zero cap (no growth)', () => {
    const p = updatePendingDistance({ previousPending: 0, distanceMoved: 5, accuracy: 0 })
    expect(p).toBe(0)
    const pNeg = updatePendingDistance({ previousPending: 0, distanceMoved: 5, accuracy: -5 })
    expect(pNeg).toBe(0)
  })

  it('clamps a negative distanceMoved to zero growth', () => {
    const p = updatePendingDistance({ previousPending: 4, distanceMoved: -2, accuracy: 15 })
    // Negative distance is nonsense, but we hold the previous high either way.
    expect(p).toBe(4)
  })

  it('preserves previousPending when nothing new accumulates', () => {
    const p = updatePendingDistance({ previousPending: 7, distanceMoved: 0, accuracy: 15 })
    expect(p).toBe(7)
  })
})

describe('smoothPosition (EMA)', () => {
  it('returns the raw fix unchanged on first call (no history)', () => {
    const r = smoothPosition(null, { lat: 45.0, lng: 9.0, accuracy: 12 })
    expect(r.lat).toBe(45.0)
    expect(r.lng).toBe(9.0)
    expect(r.accuracy).toBe(12)
  })

  it('weights a tight new fix heavily (alpha → 0.85 floor cap)', () => {
    const prev = { lat: 0, lng: 0, accuracy: 50 }
    const r = smoothPosition(prev, { lat: 1, lng: 1, accuracy: 1 })
    // alpha = clamp(20/(20+1), 0.2, 0.85) = 0.85
    // lat = 0 * 0.15 + 1 * 0.85 = 0.85
    expect(r.lat).toBeCloseTo(0.85, 4)
    expect(r.lng).toBeCloseTo(0.85, 4)
  })

  it('weights a loose new fix lightly (alpha clamps to 0.2)', () => {
    const prev = { lat: 0, lng: 0, accuracy: 5 }
    const r = smoothPosition(prev, { lat: 1, lng: 1, accuracy: 200 })
    // alpha = clamp(20/220, 0.2, 0.85) = 0.2 floor → smoothed stays near prev
    expect(r.lat).toBeCloseTo(0.2, 4)
    expect(r.lng).toBeCloseTo(0.2, 4)
  })

  it('clamps accuracy to a minimum of 1 to avoid divide-by-zero artefacts', () => {
    const r = smoothPosition({ lat: 0, lng: 0, accuracy: 10 }, { lat: 1, lng: 1, accuracy: 0 })
    // accuracy treated as 1; alpha = clamp(20/21, 0.2, 0.85) = 0.85
    expect(r.lat).toBeCloseTo(0.85, 4)
    // Output accuracy is geometric mean of prev × new (treating new as 1): sqrt(10) ≈ 3.16
    expect(r.accuracy).toBeCloseTo(Math.sqrt(10), 4)
  })

  it('damps consecutive jitter — repeatedly blending the same prev with noisy fixes converges toward prev', () => {
    let smoothed = smoothPosition(null, { lat: 0, lng: 0, accuracy: 30 })
    // Five jitter fixes ~1 m away in random-ish directions with mediocre accuracy
    const jitter = [
      { lat:  0.00001, lng:  0.00001, accuracy: 30 },
      { lat: -0.00001, lng:  0.00002, accuracy: 30 },
      { lat:  0.00002, lng: -0.00001, accuracy: 30 },
      { lat: -0.00001, lng: -0.00001, accuracy: 30 },
      { lat:  0.00001, lng:  0.00000, accuracy: 30 },
    ]
    for (const j of jitter) smoothed = smoothPosition(smoothed, j)
    // After 5 fixes at acc=30 (alpha=0.4), residue is well under 0.00001 — i.e. jitter cancelled out.
    expect(Math.abs(smoothed.lat)).toBeLessThan(0.00002)
    expect(Math.abs(smoothed.lng)).toBeLessThan(0.00002)
  })
})

describe('isStationary', () => {
  it('returns false with fewer than 3 fixes (not enough samples)', () => {
    expect(isStationary([])).toBe(false)
    expect(isStationary([{ lat: 0, lng: 0, accuracy: 5 }])).toBe(false)
    expect(isStationary([
      { lat: 0, lng: 0, accuracy: 5 },
      { lat: 0, lng: 0, accuracy: 5 },
    ])).toBe(false)
  })

  it('returns true when all fixes cluster within max(2, avgAcc/2) metres', () => {
    // All identical → trivially stationary.
    const r = isStationary([
      { lat: 45.0, lng: 9.0, accuracy: 10 },
      { lat: 45.0, lng: 9.0, accuracy: 10 },
      { lat: 45.0, lng: 9.0, accuracy: 10 },
    ])
    expect(r).toBe(true)
  })

  it('returns true when fixes are within the per-fix accuracy circle', () => {
    // ~1 m apart, avg accuracy 20 m → threshold = max(2, 10) = 10 → stationary
    const r = isStationary([
      { lat: 45.000000, lng: 9.000000, accuracy: 20 },
      { lat: 45.000005, lng: 9.000005, accuracy: 20 }, // ~0.7m away
      { lat: 45.000003, lng: 9.000001, accuracy: 20 },
      { lat: 45.000001, lng: 9.000004, accuracy: 20 },
    ])
    expect(r).toBe(true)
  })

  it('returns false when one fix is outside the cluster threshold (real movement)', () => {
    // First 3 fixes tight, 4th moved ~20 m → walking, not stationary
    const r = isStationary([
      { lat: 45.000000, lng: 9.000000, accuracy: 10 },
      { lat: 45.000003, lng: 9.000001, accuracy: 10 },
      { lat: 45.000005, lng: 9.000002, accuracy: 10 },
      { lat: 45.000200, lng: 9.000000, accuracy: 10 }, // ~22 m north
    ])
    expect(r).toBe(false)
  })

  it('uses a 2 m floor on the threshold — very-high-accuracy fixes do not allow infinitesimal "stationary"', () => {
    // Without the floor, avgAcc=1 → threshold=0.5 m, would let a real
    // 1 m walk through as "stationary". The 2 m floor catches the case.
    // Two fixes are ~1.5 m apart — under the 2 m floor → stationary
    const r = isStationary([
      { lat: 45.000000, lng: 9.000000, accuracy: 1 },
      { lat: 45.000010, lng: 9.000000, accuracy: 1 }, // ~1.1m away
      { lat: 45.000005, lng: 9.000005, accuracy: 1 },
    ])
    expect(r).toBe(true)
  })
})

describe('pushRecentFix', () => {
  it('appends to an empty window', () => {
    const next = pushRecentFix<number>([], 1, 4)
    expect(next).toEqual([1])
  })

  it('keeps the newest in order and drops the oldest at capacity', () => {
    let w: number[] = []
    w = pushRecentFix(w, 1, 4)
    w = pushRecentFix(w, 2, 4)
    w = pushRecentFix(w, 3, 4)
    w = pushRecentFix(w, 4, 4)
    expect(w).toEqual([1, 2, 3, 4])
    w = pushRecentFix(w, 5, 4)
    expect(w).toEqual([2, 3, 4, 5])
  })

  it('does not mutate the input window', () => {
    const w = [1, 2, 3]
    const next = pushRecentFix(w, 4, 4)
    expect(w).toEqual([1, 2, 3])
    expect(next).toEqual([1, 2, 3, 4])
  })

  it('treats windowSize < 1 as 1', () => {
    const next = pushRecentFix([1, 2, 3], 4, 0)
    expect(next).toEqual([4])
  })
})
