import { rollDice } from '@/lib/game/rng'

export interface BaseCombatStats {
  hp: number
  atk: number
  def: number
}

export interface ScaledCombatStats extends BaseCombatStats {
  level: number
}

export interface CombatFortuneResult {
  multiplier: number
  deltaPercent: number
  tone: 'lucky' | 'rough' | 'steady'
  label: string
  isUnderdog: boolean
}

export const CRIT_CHANCE     = 0.10   // 10% base critical hit chance
export const CRIT_MULTIPLIER = 1.75   // ×1.75 damage on critical hit

export function rollCrit(): { isCrit: boolean; critMultiplier: number } {
  const isCrit = Math.random() < CRIT_CHANCE
  return { isCrit, critMultiplier: isCrit ? CRIT_MULTIPLIER : 1 }
}

const MIN_COMBAT_LEVEL = 1
const MAX_COMBAT_LEVEL = 50
const HP_PER_LEVEL = 0.14
const ATK_PER_LEVEL = 0.1
const DEF_PER_LEVEL = 0.09
const DEFENSE_BASE = 120
const FORTUNE_MIN = 0.94
const FORTUNE_MAX = 1.06
const FORTUNE_UNDERDOG_CAP = 0.06

function roundStat(value: number, floor = 1): number {
  return Math.max(floor, Math.round(value))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function estimateCombatPower(stats: BaseCombatStats): number {
  return stats.hp * 0.34 + stats.atk * 3.2 + stats.def * 2.2
}

export function normalizeCombatLevel(level: number | null | undefined): number {
  if (!Number.isFinite(level)) return MIN_COMBAT_LEVEL
  return Math.min(MAX_COMBAT_LEVEL, Math.max(MIN_COMBAT_LEVEL, Math.round(level as number)))
}

export function scaleCombatStats(
  base: BaseCombatStats,
  level: number | null | undefined,
): ScaledCombatStats {
  const normalizedLevel = normalizeCombatLevel(level)
  const levelDelta = normalizedLevel - 1

  return {
    level: normalizedLevel,
    hp: roundStat(base.hp * (1 + levelDelta * HP_PER_LEVEL)),
    atk: roundStat(base.atk * (1 + levelDelta * ATK_PER_LEVEL)),
    def: roundStat(base.def * (1 + levelDelta * DEF_PER_LEVEL), 0),
  }
}

interface RollCombatFortuneOptions {
  attackerLevel: number | null | undefined
  defenderLevel: number | null | undefined
  attackerStats: BaseCombatStats
  defenderStats: BaseCombatStats
  randomValue?: number
}

export function rollCombatFortune({
  attackerLevel,
  defenderLevel,
  attackerStats,
  defenderStats,
  randomValue = Math.random(),
}: RollCombatFortuneOptions): CombatFortuneResult {
  const normalizedAttackerLevel = normalizeCombatLevel(attackerLevel)
  const normalizedDefenderLevel = normalizeCombatLevel(defenderLevel)
  const attackerPower = estimateCombatPower(attackerStats)
  const defenderPower = estimateCombatPower(defenderStats)
  const levelGap = Math.max(0, normalizedDefenderLevel - normalizedAttackerLevel)
  const powerGapRatio = defenderPower > 0
    ? Math.max(0, defenderPower - attackerPower) / defenderPower
    : 0
  const underdogBias = clamp(levelGap * 0.004 + powerGapRatio * 0.04, 0, FORTUNE_UNDERDOG_CAP)
  const baseMultiplier = FORTUNE_MIN + clamp(randomValue, 0, 1) * (FORTUNE_MAX - FORTUNE_MIN)
  const multiplier = clamp(baseMultiplier + underdogBias, 0.92, 1.14)
  const deltaPercent = Math.round((multiplier - 1) * 100)

  if (deltaPercent >= 8) {
    return { multiplier, deltaPercent, tone: 'lucky', label: 'Colpo fortunato', isUnderdog: underdogBias > 0 }
  }
  if (deltaPercent >= 3) {
    return { multiplier, deltaPercent, tone: 'lucky', label: 'Buona sorte', isUnderdog: underdogBias > 0 }
  }
  if (deltaPercent <= -5) {
    return { multiplier, deltaPercent, tone: 'rough', label: 'Colpo incerto', isUnderdog: underdogBias > 0 }
  }

  return { multiplier, deltaPercent, tone: 'steady', label: 'Colpo stabile', isUnderdog: underdogBias > 0 }
}

interface CalculateCombatDamageOptions {
  attackerAtk: number
  defenderDef: number
  attackMultiplier?: number
  elementMultiplier?: number
  varianceMultiplier?: number
}

export function calculateCombatDamage({
  attackerAtk,
  defenderDef,
  attackMultiplier = 1,
  elementMultiplier = 1,
  varianceMultiplier = rollDice(),
}: CalculateCombatDamageOptions): number {
  const mitigation = DEFENSE_BASE / (DEFENSE_BASE + Math.max(0, defenderDef))
  const rawDamage = attackerAtk * attackMultiplier * elementMultiplier * varianceMultiplier

  return Math.max(1, Math.round(rawDamage * mitigation))
}
