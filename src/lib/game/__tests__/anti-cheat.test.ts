import { describe, it, expect } from 'vitest'
import { isValidGPSSpeed } from '@/lib/game/anti-cheat'

describe('isValidGPSSpeed', () => {
  it('accepts normal walking speed', () => {
    // 10m in 10s = 1 m/s = 3.6 km/h
    expect(isValidGPSSpeed(
      { lat: 43.9097, lng: 12.9094 },
      { lat: 43.9098, lng: 12.9094 }, // ~11m north
      10000 // 10 seconds
    )).toBe(true)
  })

  it('rejects teleportation (>60 km/h)', () => {
    // 1km in 1s
    expect(isValidGPSSpeed(
      { lat: 43.9097, lng: 12.9094 },
      { lat: 43.9187, lng: 12.9094 }, // ~1000m
      1000  // 1 second
    )).toBe(false)
  })

  it('accepts first position (no previous)', () => {
    expect(isValidGPSSpeed(null, { lat: 43.9097, lng: 12.9094 }, 0)).toBe(true)
  })
})
