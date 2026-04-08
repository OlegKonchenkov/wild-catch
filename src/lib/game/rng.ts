import { RARITY_CATCH_RATES, CATCH_DIFFICULTY_MULT } from '@/lib/types'
import type { Rarity } from '@/lib/types'

export function rollDice(): number {
  return 0.8 + Math.random() * 0.4  // 0.8 to 1.2
}

export function rollCatch(rarity: Rarity, bonusAdditive: number, difficulty = 3): boolean {
  const baseRate = RARITY_CATCH_RATES[rarity] * (CATCH_DIFFICULTY_MULT[difficulty] ?? 1.0)
  const rate = Math.min(1.0, baseRate + bonusAdditive)
  return Math.random() < rate
}

interface SpawnableCreature {
  id: string
  spawn_weight: number
  rarity: Rarity
  min_level: number
}

// Two-stage spawn system:
//   Stage 1 — pick a RARITY TIER via tier base weights scaled by level bonus.
//             Adding/removing creatures never changes tier probabilities.
//   Stage 2 — pick a SPECIFIC CREATURE within the tier via spawn_weight.
//             spawn_weight controls variety inside the tier only.

// Base weight for each rarity tier (level 1, no bonuses).
// Tune these to set the floor probabilities; they scale with DEFAULT_RARITY_LEVEL_BONUS.
export const DEFAULT_RARITY_TIER_WEIGHTS: Record<string, number> = {
  comune:      65,
  non_comune:  22,
  raro:        7,
  epico:       4,
  leggendario: 2,
}

// Per-level multiplier bonus applied to each tier's base weight.
// At level N: effective_tier_weight = base * (1 + bonus * N)
export const DEFAULT_RARITY_LEVEL_BONUS: Record<string, number> = {
  comune:      0,
  non_comune:  0.02,  // ×1.2 at lv10, ×1.4 at lv20
  raro:        0.10,  // ×2.0 at lv10, ×3.0 at lv20
  epico:       0.20,  // ×3.0 at lv10, ×5.0 at lv20
  leggendario: 0.40,  // ×5.0 at lv10, ×9.0 at lv20
}

export interface SpawnBonusConfig {
  non_comune_bonus?: number
  raro_bonus?: number
  epico_bonus?: number
  leggendario_bonus?: number
}

export function selectCreatureForEncounter(
  creatures: SpawnableCreature[],
  playerLevel: number,
  spawnConfig?: SpawnBonusConfig,
): SpawnableCreature | null {
  if (creatures.length === 0) return null

  const levelBonusMap: Record<string, number> = {
    comune:      0,
    non_comune:  spawnConfig?.non_comune_bonus ?? DEFAULT_RARITY_LEVEL_BONUS.non_comune,
    raro:        spawnConfig?.raro_bonus        ?? DEFAULT_RARITY_LEVEL_BONUS.raro,
    epico:       spawnConfig?.epico_bonus       ?? DEFAULT_RARITY_LEVEL_BONUS.epico,
    leggendario: spawnConfig?.leggendario_bonus ?? DEFAULT_RARITY_LEVEL_BONUS.leggendario,
  }

  // Stage 1: pick rarity tier
  const presentRarities = [...new Set(creatures.map(c => c.rarity))]
  const tierWeights = presentRarities.map(rarity => ({
    rarity,
    weight: (DEFAULT_RARITY_TIER_WEIGHTS[rarity] ?? 1) * (1 + (levelBonusMap[rarity] ?? 0) * playerLevel),
  }))
  const totalTierWeight = tierWeights.reduce((sum, t) => sum + t.weight, 0)
  let tierRng = Math.random() * totalTierWeight
  let selectedRarity: string = presentRarities[0]
  for (const t of tierWeights) {
    tierRng -= t.weight
    if (tierRng <= 0) { selectedRarity = t.rarity; break }
  }

  // Stage 2: pick creature within tier via spawn_weight
  const pool = creatures.filter(c => c.rarity === selectedRarity)
  if (pool.length === 0) return creatures[creatures.length - 1]
  const totalPoolWeight = pool.reduce((sum, c) => sum + c.spawn_weight, 0)
  let poolRng = Math.random() * totalPoolWeight
  for (const c of pool) {
    poolRng -= c.spawn_weight
    if (poolRng <= 0) return c
  }
  return pool[pool.length - 1]
}

export function calculateFightDamage(atk: number): number {
  return Math.round(atk * rollDice())
}
