import { describe, it, expect } from 'vitest'
import { evaluateStep, shouldRollEncounter, STEP_FILTER, updatePendingDistance } from '@/lib/game/step-counter'

/**
 * Contract tests for the GPS step filter. These nail down the anti-jitter
 * behaviour described in 028_last_position_at + the position route comments.
 * Each case represents a real-world scenario we want the filter to handle.
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
      const r = evaluateStep({ ...baseInput, distanceMoved: 8, accuracy: 6 })
      expect(r.validStep).toBe(true)
      expect(r.stepsIncrement).toBe(8)
      expect(r.shouldUpdateBaseline).toBe(true)
    })

    it('rounds fractional metres', () => {
      const r = evaluateStep({ ...baseInput, distanceMoved: 7.4, accuracy: 5 })
      expect(r.stepsIncrement).toBe(7)
    })
  })

  describe('SNR (signal-to-noise) filter', () => {
    it('rejects a "move" smaller than 0.8 × accuracy (stationary GPS jitter)', () => {
      // User is standing still, GPS reports 30 m accuracy and drifts 10 m.
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

    it('accepts a slow run at 3 m/s', () => {
      // 15 m in 5 s = 3 m/s = 10.8 km/h
      const r = evaluateStep({ ...baseInput, distanceMoved: 15, accuracy: 10, elapsedMs: 5000 })
      expect(r.validStep).toBe(true)
    })

    it('skips velocity check when no elapsed time is known (first fix)', () => {
      const r = evaluateStep({ ...baseInput, distanceMoved: 10, accuracy: 6, elapsedMs: null })
      expect(r.validStep).toBe(true)
    })
  })

  describe('session gating', () => {
    it('rejects steps while session is "ready" (pre-start lobby)', () => {
      const r = evaluateStep({ ...baseInput, sessionStatus: 'ready', distanceMoved: 10, accuracy: 5 })
      expect(r.validStep).toBe(false)
    })

    it('rejects steps while session is "ended"', () => {
      const r = evaluateStep({ ...baseInput, sessionStatus: 'ended', distanceMoved: 10, accuracy: 5 })
      expect(r.validStep).toBe(false)
    })

    it('rejects steps when player is out of bounds', () => {
      const r = evaluateStep({ ...baseInput, inBounds: false, distanceMoved: 10, accuracy: 5 })
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
    p = updatePendingDistance({ previousPending: p, distanceMoved: 7.0, accuracy: 15 })
    expect(p).toBe(7.0)
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
    const p1 = updatePendingDistance({ previousPending: 0, distanceMoved: 11, accuracy: 15 })
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
