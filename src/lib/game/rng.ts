import { RARITY_CATCH_RATES } from '@/lib/types'
import type { Rarity } from '@/lib/types'

export function rollDice(): number {
  return 0.8 + Math.random() * 0.4  // 0.8 to 1.2
}

export function rollCatch(rarity: Rarity, bonusAdditive: number): boolean {
  const baseRate = RARITY_CATCH_RATES[rarity]
  const rate = Math.min(1.0, baseRate + bonusAdditive)
  return Math.random() < rate
}

interface SpawnableCreature {
  id: string
  spawn_weight: number
  rarity: Rarity
  min_level: number
}

// At level N, effective weight = base * (1 + bonus * N)
// This makes rarer creatures progressively more common as player levels up
// while keeping them accessible from level 1.
export const DEFAULT_RARITY_LEVEL_BONUS: Record<string, number> = {
  comune:      0,
  non_comune:  0.02,  // +2% per level  (×1.2 at lv10, ×1.4 at lv20)
  raro:        0.10,  // +10% per level (×2   at lv10, ×3   at lv20)
  epico:       0.20,  // +20% per level (×3   at lv10, ×5   at lv20)
  leggendario: 0.40,  // +40% per level (×5   at lv10, ×9   at lv20)
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

  const bonusMap: Record<string, number> = {
    comune:      0,
    non_comune:  spawnConfig?.non_comune_bonus ?? DEFAULT_RARITY_LEVEL_BONUS.non_comune,
    raro:        spawnConfig?.raro_bonus        ?? DEFAULT_RARITY_LEVEL_BONUS.raro,
    epico:       spawnConfig?.epico_bonus       ?? DEFAULT_RARITY_LEVEL_BONUS.epico,
    leggendario: spawnConfig?.leggendario_bonus ?? DEFAULT_RARITY_LEVEL_BONUS.leggendario,
  }

  const effectiveWeight = (c: SpawnableCreature) => {
    const bonus = bonusMap[c.rarity] ?? 0
    return c.spawn_weight * (1 + bonus * playerLevel)
  }

  const totalWeight = creatures.reduce((sum, c) => sum + effectiveWeight(c), 0)
  let random = Math.random() * totalWeight

  for (const creature of creatures) {
    random -= effectiveWeight(creature)
    if (random <= 0) return creature
  }
  return creatures[creatures.length - 1]
}

export function calculateFightDamage(atk: number): number {
  return Math.round(atk * rollDice())
}
