import { describe, it, expect } from 'vitest'
import { rollCatch, rollDice, selectCreatureForEncounter } from '@/lib/game/rng'
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

  it('bonus additivo increases catch rate', () => {
    let noBonus = 0, withBonus = 0
    for (let i = 0; i < 1000; i++) {
      if (rollCatch('raro', 0)) noBonus++
      if (rollCatch('raro', 0.20)) withBonus++
    }
    expect(withBonus).toBeGreaterThan(noBonus)
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
})
