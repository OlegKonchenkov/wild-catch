import { describe, expect, it } from 'vitest'
import {
  calculateCombatDamage,
  calculatePoisonDamage,
  normalizeCombatLevel,
  rollConfusionSelfHit,
  rollCombatFortune,
  rollParalysisSkip,
  scaleCombatStats,
  shouldSkipCounterattackOnStatusApply,
} from '@/lib/game/combat'

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

  it('gives a small fortune edge to the underdog at the same random roll', () => {
    const evenFight = rollCombatFortune({
      attackerLevel: 10,
      defenderLevel: 10,
      attackerStats: { hp: 120, atk: 30, def: 18 },
      defenderStats: { hp: 120, atk: 30, def: 18 },
      randomValue: 0.5,
    })
    const underdogFight = rollCombatFortune({
      attackerLevel: 5,
      defenderLevel: 12,
      attackerStats: { hp: 90, atk: 22, def: 12 },
      defenderStats: { hp: 140, atk: 34, def: 22 },
      randomValue: 0.5,
    })

    expect(underdogFight.multiplier).toBeGreaterThan(evenFight.multiplier)
    expect(underdogFight.isUnderdog).toBe(true)
  })

  it('only paralysis and sleep block the immediate counterattack on application', () => {
    expect(shouldSkipCounterattackOnStatusApply('paralisi')).toBe(true)
    expect(shouldSkipCounterattackOnStatusApply('sonno')).toBe(true)
    expect(shouldSkipCounterattackOnStatusApply('confusione')).toBe(false)
    expect(shouldSkipCounterattackOnStatusApply('veleno')).toBe(false)
  })

  it('keeps paralysis at 65% skip and 35% attack with the expected threshold', () => {
    expect(rollParalysisSkip(0)).toBe(true)
    expect(rollParalysisSkip(0.649999)).toBe(true)
    expect(rollParalysisSkip(0.65)).toBe(false)
    expect(rollParalysisSkip(0.99)).toBe(false)
  })

  it('keeps confusion at a flat 50% self-hit chance', () => {
    expect(rollConfusionSelfHit(0)).toBe(true)
    expect(rollConfusionSelfHit(0.499999)).toBe(true)
    expect(rollConfusionSelfHit(0.5)).toBe(false)
    expect(rollConfusionSelfHit(0.99)).toBe(false)
  })

  it('applies poison at 10% of max hp with a minimum of 1', () => {
    expect(calculatePoisonDamage(100)).toBe(10)
    expect(calculatePoisonDamage(55)).toBe(6)
    expect(calculatePoisonDamage(1)).toBe(1)
  })
})
