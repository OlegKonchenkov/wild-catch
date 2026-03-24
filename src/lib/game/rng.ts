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

export function selectCreatureForEncounter(
  creatures: SpawnableCreature[],
  playerLevel: number
): SpawnableCreature | null {
  const eligible = creatures.filter(c => c.min_level <= playerLevel)
  if (eligible.length === 0) return null

  const totalWeight = eligible.reduce((sum, c) => sum + c.spawn_weight, 0)
  let random = Math.random() * totalWeight

  for (const creature of eligible) {
    random -= creature.spawn_weight
    if (random <= 0) return creature
  }
  return eligible[eligible.length - 1]
}

export function calculateFightDamage(atk: number): number {
  return Math.round(atk * rollDice())
}
