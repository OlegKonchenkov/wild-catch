import { describe, expect, it } from 'vitest'
import { calculateCombatDamage, normalizeCombatLevel, scaleCombatStats } from '@/lib/game/combat'

describe('combat helpers', () => {
  it('normalizes invalid levels to 1', () => {
    expect(normalizeCombatLevel(undefined)).toBe(1)
    expect(normalizeCombatLevel(0)).toBe(1)
    expect(normalizeCombatLevel(-4)).toBe(1)
  })

  it('scales hp, atk and def upward with level', () => {
    const base = { hp: 100, atk: 20, def: 10 }
    const scaled = scaleCombatStats(base, 10)

    expect(scaled.level).toBe(10)
    expect(scaled.hp).toBeGreaterThan(base.hp)
    expect(scaled.atk).toBeGreaterThan(base.atk)
    expect(scaled.def).toBeGreaterThan(base.def)
  })

  it('reduces damage when defender has more defense', () => {
    const lowDef = calculateCombatDamage({
      attackerAtk: 50,
      defenderDef: 5,
      attackMultiplier: 1,
      elementMultiplier: 1,
      varianceMultiplier: 1,
    })
    const highDef = calculateCombatDamage({
      attackerAtk: 50,
      defenderDef: 45,
      attackMultiplier: 1,
      elementMultiplier: 1,
      varianceMultiplier: 1,
    })

    expect(highDef).toBeLessThan(lowDef)
  })
})
