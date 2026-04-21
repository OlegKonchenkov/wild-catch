import { describe, expect, it } from 'vitest'
import {
  calculateCombatDamage,
  calculatePoisonDamage,
  normalizeCombatLevel,
  resolveTurnStartStatus,
  rollConfusionSelfHit,
  rollCombatFortune,
  rollParalysisSkip,
  scaleCombatStats,
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

  it('keeps poison as a damage tick and never as an automatic skipped turn', () => {
    const result = resolveTurnStartStatus({
      effect: 'veleno',
      turnsLeft: 0,
      currentHp: 40,
      maxHp: 100,
      atk: 20,
      def: 10,
    })

    expect(result.preventedAction).toBe(false)
    expect(result.nextEffect).toBe('veleno')
    expect(result.currentHp).toBe(30)
    expect(result.event).toMatchObject({
      type: 'veleno',
      poisonDamage: 10,
      newHp: 30,
      fainted: false,
    })
  })

  it('resolves paralysis as 65% skip and decrements the duration', () => {
    const result = resolveTurnStartStatus({
      effect: 'paralisi',
      turnsLeft: 2,
      currentHp: 50,
      maxHp: 100,
      atk: 20,
      def: 10,
      randomValue: 0.3,
    })

    expect(result.preventedAction).toBe(true)
    expect(result.nextEffect).toBe('paralisi')
    expect(result.nextTurnsLeft).toBe(1)
    expect(result.event).toMatchObject({
      type: 'paralisi',
      paralysisSkip: true,
      cleared: false,
      turnsLeft: 1,
    })
  })

  it('resolves confusion self-hit with real self-damage and duration decrement', () => {
    const result = resolveTurnStartStatus({
      effect: 'confusione',
      turnsLeft: 3,
      currentHp: 28,
      maxHp: 100,
      atk: 40,
      def: 10,
      randomValue: 0.2,
    })

    expect(result.preventedAction).toBe(true)
    expect(result.nextEffect).toBe('confusione')
    expect(result.nextTurnsLeft).toBe(2)
    expect(result.currentHp).toBeLessThan(28)
    expect(result.event).toMatchObject({
      type: 'confusione',
      selfHit: true,
      cleared: false,
      turnsLeft: 2,
    })
  })
})
