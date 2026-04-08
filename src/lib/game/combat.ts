import { rollDice } from '@/lib/game/rng'

export interface BaseCombatStats {
  hp: number
  atk: number
  def: number
}

export interface ScaledCombatStats extends BaseCombatStats {
  level: number
}

const MIN_COMBAT_LEVEL = 1
const MAX_COMBAT_LEVEL = 50
const HP_PER_LEVEL = 0.14
const ATK_PER_LEVEL = 0.1
const DEF_PER_LEVEL = 0.09
const DEFENSE_BASE = 120

function roundStat(value: number, floor = 1): number {
  return Math.max(floor, Math.round(value))
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
