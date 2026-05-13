import { describe, expect, it, vi } from 'vitest'
import {
  calculateCombatDamage,
  calculatePoisonDamage,
  normalizeCombatLevel,
  resolveTurnStartStatus,
  rollConfusionSelfHit,
  rollCombatFortune,
  rollParalysisSkip,
  rollStatusEffect,
  scaleCombatStats,
  STATUS_EFFECT_META,
} from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'

describe('combat helpers', () => {
  it('normalizes invalid levels to 1', () => {
    expect(normalizeCombatLevel(undefined)).toBe(1)
    expect(normalizeCombatLevel(0)).toBe(1)
    expect(normalizeCombatLevel(-4)).toBe(1)
  })

  it('scaleCombatStats: level 1 returns base stats unchanged', () => {
    const base = { hp: 100, atk: 20, def: 10 }
    const s = scaleCombatStats(base, 1)
    expect(s).toMatchObject({ level: 1, hp: 100, atk: 20, def: 10 })
  })

  it('scaleCombatStats: stats increase monotonically from level 1 → 10 → 50', () => {
    const base = { hp: 100, atk: 20, def: 10 }
    const s10 = scaleCombatStats(base, 10)
    const s50 = scaleCombatStats(base, 50)
    expect(s10.hp).toBeGreaterThan(base.hp)
    expect(s50.hp).toBeGreaterThan(s10.hp)
    expect(s50.atk).toBeGreaterThan(s10.atk)
  })

  it('scaleCombatStats: level clamped at MAX_COMBAT_LEVEL (50)', () => {
    const base = { hp: 100, atk: 20, def: 10 }
    const s50 = scaleCombatStats(base, 50)
    const s99 = scaleCombatStats(base, 99)
    expect(s99).toMatchObject(s50)
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

  it('resolves sonno: always prevents action and decrements turns', () => {
    const result = resolveTurnStartStatus({
      effect: 'sonno',
      turnsLeft: 2,
      currentHp: 60,
      maxHp: 100,
      atk: 20,
      def: 10,
    })

    expect(result.preventedAction).toBe(true)
    expect(result.nextEffect).toBe('sonno')
    expect(result.nextTurnsLeft).toBe(1)
    expect(result.currentHp).toBe(60)
    expect(result.event).toMatchObject({ type: 'sonno', cleared: false, turnsLeft: 1 })
  })

  it('resolves sonno: clears when turns reach 0', () => {
    const result = resolveTurnStartStatus({
      effect: 'sonno',
      turnsLeft: 1,
      currentHp: 60,
      maxHp: 100,
      atk: 20,
      def: 10,
    })

    expect(result.nextEffect).toBeNull()
    expect(result.nextTurnsLeft).toBe(0)
    expect(result.event).toMatchObject({ cleared: true })
  })

  it('no effect: returns pristine state', () => {
    const result = resolveTurnStartStatus({
      effect: null,
      currentHp: 80,
      maxHp: 100,
      atk: 20,
      def: 10,
    })

    expect(result).toMatchObject({
      nextEffect: null,
      nextTurnsLeft: 0,
      currentHp: 80,
      preventedAction: false,
      fainted: false,
      event: null,
    })
  })
})

describe('rollStatusEffect', () => {
  it('returns the effect when random < chance (guaranteed proc)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    expect(rollStatusEffect('paralisi', 0.15)).toBe('paralisi')
    vi.restoreAllMocks()
  })

  it('returns null when random >= chance (guaranteed miss)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    expect(rollStatusEffect('paralisi', 0.15)).toBeNull()
    vi.restoreAllMocks()
  })

  it('returns null when statusEffect is null', () => {
    expect(rollStatusEffect(null, 0.99)).toBeNull()
  })

  it('returns null when statusEffect is undefined', () => {
    expect(rollStatusEffect(undefined, 0.99)).toBeNull()
  })

  it('uses default chance 0.15 when chance is null', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.10)
    expect(rollStatusEffect('veleno', null)).toBe('veleno')
    vi.restoreAllMocks()
  })
})

describe('STATUS_EFFECT_META', () => {
  const effects: StatusEffect[] = ['paralisi', 'confusione', 'sonno', 'veleno']

  it.each(effects)('%s has label, emoji, color, and glow', (effect) => {
    const meta = STATUS_EFFECT_META[effect]
    expect(meta).toBeDefined()
    expect(typeof meta.label).toBe('string')
    expect(meta.label.length).toBeGreaterThan(0)
    expect(typeof meta.emoji).toBe('string')
    expect(meta.emoji.length).toBeGreaterThan(0)
    expect(meta.color).toMatch(/^#/)
    expect(meta.glow).toMatch(/^rgba\(/)
  })

  it('sonno preventsAttack, others do not (except as action result)', () => {
    expect(STATUS_EFFECT_META.sonno.preventsAttack).toBe(true)
    expect(STATUS_EFFECT_META.paralisi.preventsAttack).toBe(false)
    expect(STATUS_EFFECT_META.confusione.preventsAttack).toBe(false)
    expect(STATUS_EFFECT_META.veleno.preventsAttack).toBe(false)
  })
})
