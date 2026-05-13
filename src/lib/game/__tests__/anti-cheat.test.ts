import { describe, it, expect } from 'vitest'
import { isValidGPSSpeed, haversineDistance, isWithinBounds, parsePoint } from '@/lib/game/anti-cheat'

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

const TRIESTE = { lat: 45.6495, lng: 13.7768 }

describe('haversineDistance', () => {
  it('returns ~100 m for a point 100 m north', () => {
    // dlat = 100 / 111111 deg ≈ 0.0009
    const north = { lat: 45.6504, lng: 13.7768 }
    const d = haversineDistance(TRIESTE, north)
    expect(d).toBeGreaterThan(90)
    expect(d).toBeLessThan(110)
  })

  it('returns ~100 m for a point 100 m east', () => {
    // dlng at lat 45.65° ≈ 100 / 77740 deg ≈ 0.001286
    const east = { lat: 45.6495, lng: 13.7781 }
    const d = haversineDistance(TRIESTE, east)
    expect(d).toBeGreaterThan(90)
    expect(d).toBeLessThan(110)
  })

  it('returns 0 for identical points', () => {
    expect(haversineDistance(TRIESTE, TRIESTE)).toBe(0)
  })

  it('is symmetric', () => {
    const other = { lat: 45.6504, lng: 13.7781 }
    expect(haversineDistance(TRIESTE, other)).toBeCloseTo(haversineDistance(other, TRIESTE), 5)
  })
})

describe('isWithinBounds', () => {
  const bounds = { north: 46.0, south: 45.0, east: 14.0, west: 13.0 }

  it('returns true for a point inside the bounds', () => {
    expect(isWithinBounds({ lat: 45.5, lng: 13.5 }, bounds)).toBe(true)
  })

  it('returns true on the north edge', () => {
    expect(isWithinBounds({ lat: 46.0, lng: 13.5 }, bounds)).toBe(true)
  })

  it('returns true on the south edge', () => {
    expect(isWithinBounds({ lat: 45.0, lng: 13.5 }, bounds)).toBe(true)
  })

  it('returns true on the east edge', () => {
    expect(isWithinBounds({ lat: 45.5, lng: 14.0 }, bounds)).toBe(true)
  })

  it('returns true on the west edge', () => {
    expect(isWithinBounds({ lat: 45.5, lng: 13.0 }, bounds)).toBe(true)
  })

  it('returns false north of bounds', () => {
    expect(isWithinBounds({ lat: 46.1, lng: 13.5 }, bounds)).toBe(false)
  })

  it('returns false south of bounds', () => {
    expect(isWithinBounds({ lat: 44.9, lng: 13.5 }, bounds)).toBe(false)
  })

  it('returns false east of bounds', () => {
    expect(isWithinBounds({ lat: 45.5, lng: 14.1 }, bounds)).toBe(false)
  })

  it('returns false west of bounds', () => {
    expect(isWithinBounds({ lat: 45.5, lng: 12.9 }, bounds)).toBe(false)
  })
})

describe('parsePoint', () => {
  it('parses PostgREST string "(lng,lat)" → {lat, lng}', () => {
    expect(parsePoint('(12.5,45.6)')).toEqual({ lat: 45.6, lng: 12.5 })
  })

  it('parses object {x, y} form', () => {
    expect(parsePoint({ x: 13.7768, y: 45.6495 })).toEqual({ lat: 45.6495, lng: 13.7768 })
  })

  it('returns null for null, undefined, and empty string', () => {
    expect(parsePoint(null)).toBeNull()
    expect(parsePoint(undefined)).toBeNull()
    expect(parsePoint('')).toBeNull()
  })

  it('returns null for a malformed string (no parens)', () => {
    expect(parsePoint('12.5,45.6')).toBeNull()
  })

  it('returns null for non-numeric values inside parens', () => {
    expect(parsePoint('(abc,def)')).toBeNull()
  })

  it('returns null for a string with only one coordinate', () => {
    expect(parsePoint('(12.5)')).toBeNull()
  })
})
