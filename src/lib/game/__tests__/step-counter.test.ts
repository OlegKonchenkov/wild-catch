import { describe, it, expect } from 'vitest'
import { evaluateStep, shouldRollEncounter, STEP_FILTER } from '@/lib/game/step-counter'

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
