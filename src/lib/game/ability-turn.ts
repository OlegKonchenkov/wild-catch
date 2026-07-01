import { normalizeAbilityState, type AbilityBattleState } from '@/lib/game/abilities'

// ─────────────────────────────────────────────────────────────────────────────
// Shared JSONB shape for single-enemy combat (wild encounters + boss fights).
// The player creature owns a full AbilityBattleState (cooldowns / charge / PP /
// self-buffs); the single enemy only needs stat modifiers from the player's
// debuffs, so we track those as two scalars rather than a whole state object.
// ─────────────────────────────────────────────────────────────────────────────

export interface EncounterAbilityState {
  player: AbilityBattleState
  enemyAtkMod: number
  enemyDefMod: number
}

export function normalizeEncounterAbilityState(raw: unknown): EncounterAbilityState {
  const s = (raw ?? {}) as Record<string, unknown>
  return {
    player: normalizeAbilityState(s.player),
    enemyAtkMod: clampMod(Number(s.enemyAtkMod) || 0),
    enemyDefMod: clampMod(Number(s.enemyDefMod) || 0),
  }
}

export function clampMod(v: number): number {
  return Math.max(-0.75, Math.min(2, v))
}
