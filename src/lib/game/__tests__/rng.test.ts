import { describe, it, expect, vi } from 'vitest'
import { calculateCatchRate, getCatchHealthMultiplier, rollCatch, rollDice, selectCreatureForEncounter, calculateFightDamage } from '@/lib/game/rng'
import type { Rarity } from '@/lib/types'

describe('rollCatch', () => {
  it('comune with no bonus catches more than 60% of the time', () => {
    let caught = 0
    for (let i = 0; i < 1000; i++) if (rollCatch('comune', 0)) caught++
    expect(caught).toBeGreaterThan(600)
    expect(caught).toBeLessThan(800)
  })

  it('leggendario without bonus misses most of the time', () => {
    let caught = 0
    for (let i = 0; i < 1000; i++) if (rollCatch('leggendario', 0)) caught++
    expect(caught).toBeLessThan(100)
  })

  it('mitologico without bonus is far rarer than leggendario', () => {
    let caught = 0
    for (let i = 0; i < 4000; i++) if (rollCatch('mitologico', 0)) caught++
    expect(caught).toBeLessThan(90)
  })

  it('item bonus additivo still increases catch rate', () => {
    let noBonus = 0, withBonus = 0
    for (let i = 0; i < 1000; i++) {
      if (rollCatch('raro', 0)) noBonus++
      if (rollCatch('raro', 0.20)) withBonus++
    }
    expect(withBonus).toBeGreaterThan(noBonus)
  })

  it('hp multipliers increase catch rate without flattening rarity', () => {
    const legendaryBase = calculateCatchRate('leggendario', 0, 3, 1)
    const legendaryLowHp = calculateCatchRate('leggendario', 0, 3, 2.25)
    const mythicLowHp = calculateCatchRate('mitologico', 0, 3, 2.25)

    expect(legendaryLowHp).toBeGreaterThan(legendaryBase)
    expect(mythicLowHp).toBeLessThan(legendaryLowHp)
  })
})

describe('getCatchHealthMultiplier', () => {
  // Continuous model: 1 + (1 - hpRatio) * 2.0 — every 10% HP removed adds +0.2,
  // from ×1.0 at full HP to ×3.0 at 0 HP. Matches the Guide ("Gli Incontri").
  it('gives no bonus at full HP', () => {
    expect(getCatchHealthMultiplier(100, 100)).toBe(1)
  })

  it('scales proportionally with missing HP', () => {
    expect(getCatchHealthMultiplier(90, 100)).toBeCloseTo(1.2)
    expect(getCatchHealthMultiplier(50, 100)).toBe(2.0)
    expect(getCatchHealthMultiplier(10, 100)).toBeCloseTo(2.8)
  })

  it('caps at ×3.0 at 0 HP', () => {
    expect(getCatchHealthMultiplier(0, 100)).toBe(3.0)
  })

  it('clamps out-of-range HP (over-full and negative)', () => {
    expect(getCatchHealthMultiplier(120, 100)).toBe(1)
    expect(getCatchHealthMultiplier(-10, 100)).toBe(3.0)
  })
})

describe('rollDice', () => {
  it('returns value between 0.8 and 1.2', () => {
    for (let i = 0; i < 100; i++) {
      const v = rollDice()
      expect(v).toBeGreaterThanOrEqual(0.8)
      expect(v).toBeLessThanOrEqual(1.2)
    }
  })
})

describe('selectCreatureForEncounter', () => {
  it('selects creature proportional to spawn_weight', () => {
    const creatures = [
      { id: 'a', spawn_weight: 90, rarity: 'comune' as Rarity, min_level: 1 },
      { id: 'b', spawn_weight: 10, rarity: 'raro' as Rarity, min_level: 1 },
    ]
    const counts = { a: 0, b: 0 }
    for (let i = 0; i < 1000; i++) {
      const c = selectCreatureForEncounter(creatures, 1)
      counts[c!.id as 'a' | 'b']++
    }
    expect(counts.a).toBeGreaterThan(800)
    expect(counts.b).toBeLessThan(200)
  })

  it('never selects creatures above the player min_level when eligible options exist', () => {
    const creatures = [
      { id: 'a', spawn_weight: 100, rarity: 'comune' as Rarity, min_level: 1 },
      { id: 'm', spawn_weight: 100, rarity: 'mitologico' as Rarity, min_level: 20 },
    ]
    for (let i = 0; i < 200; i++) {
      const c = selectCreatureForEncounter(creatures, 5)
      expect(c?.id).toBe('a')
    }
  })

  it('returns null for an empty pool', () => {
    expect(selectCreatureForEncounter([], 10)).toBeNull()
  })

  it('always returns the only creature in a single-entry pool', () => {
    const creatures = [{ id: 'solo', spawn_weight: 1, rarity: 'epico' as Rarity, min_level: 1 }]
    for (let i = 0; i < 20; i++) {
      expect(selectCreatureForEncounter(creatures, 5)?.id).toBe('solo')
    }
  })

  it('falls back to full pool when player level is below all min_levels', () => {
    const creatures = [
      { id: 'high1', spawn_weight: 50, rarity: 'raro' as Rarity, min_level: 30 },
      { id: 'high2', spawn_weight: 50, rarity: 'epico' as Rarity, min_level: 40 },
    ]
    // Player level 1 < all min_levels → fallback to full pool → must return one of them
    for (let i = 0; i < 20; i++) {
      const c = selectCreatureForEncounter(creatures, 1)
      expect(['high1', 'high2']).toContain(c?.id)
    }
  })
})

describe('calculateFightDamage', () => {
  it('returns a positive integer for a positive atk', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    // rollDice() = 0.8 + 0.5 * 0.4 = 1.0 → Math.round(100 * 1.0) = 100
    expect(calculateFightDamage(100)).toBe(100)
    vi.restoreAllMocks()
  })

  it('result is within the 0.8–1.2× atk range across random rolls', () => {
    vi.restoreAllMocks()
    for (let i = 0; i < 50; i++) {
      const d = calculateFightDamage(100)
      expect(d).toBeGreaterThanOrEqual(80)
      expect(d).toBeLessThanOrEqual(120)
    }
  })

  it('returns 0 for atk = 0', () => {
    expect(calculateFightDamage(0)).toBe(0)
  })
})
