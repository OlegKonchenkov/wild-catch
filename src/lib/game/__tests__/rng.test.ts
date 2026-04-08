import { describe, it, expect } from 'vitest'
import { calculateCatchRate, getCatchHealthMultiplier, rollCatch, rollDice, selectCreatureForEncounter } from '@/lib/game/rng'
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
  it('returns no bonus above half hp', () => {
    expect(getCatchHealthMultiplier(80, 100)).toBe(1)
  })

  it('returns weakened bonus at or below half hp', () => {
    expect(getCatchHealthMultiplier(50, 100)).toBe(1.5)
  })

  it('returns critical bonus at or below 30% hp', () => {
    expect(getCatchHealthMultiplier(30, 100)).toBe(2.25)
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
})
