import {
  calculateCombatDamage,
  getAttackerDamageMultiplier,
  getIncomingDamageMultiplier,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  type StatusEffect,
} from '@/lib/game/combat'
import { getElementMultiplier } from '@/lib/game/elements'
import { RARITY_RANK, type Element, type Rarity } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// Special Abilities — pure combat resolver.
//
// A Daimon always keeps its free base attack. On top of that it can learn up to
// 4 abilities (see migration 049). This module is the single source of truth for
// how an ability resolves; the encounter / boss / duel routes call into it so all
// three combat modes behave identically. Pure + deterministic (inject `rng`) so
// it is fully unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

export type AbilityCategory = 'attacco' | 'stato' | 'cura' | 'potenziamento' | 'difesa'
export type AbilityTarget = 'enemy' | 'self'

export interface Ability {
  id: string
  name: string
  description: string
  element: Element | null
  category: AbilityCategory
  rarity: Rarity | null
  power: number
  accuracy: number
  target: AbilityTarget
  priority: number
  charge_turns: number
  recharge_turns: number
  cooldown: number
  max_uses: number | null
  hits_min: number
  hits_max: number
  status_effect: StatusEffect | null
  status_chance: number
  self_status: StatusEffect | null
  heal_percent: number
  lifesteal_percent: number
  buff_atk: number
  buff_def: number
  debuff_atk: number
  debuff_def: number
  min_level: number
  min_rarity: Rarity | null
  allowed_elements: string[] | null
  icon_url: string | null
  animation_key: string
  sound_url: string | null
  color: string | null
}

/** Per-battle mutable state for ONE combatant's abilities. Persisted as JSONB. */
export interface AbilityBattleState {
  /** abilityId → turns until reusable. */
  cooldowns: Record<string, number>
  /** abilityId → remaining PP (only tracked when the ability has max_uses). */
  usesLeft: Record<string, number>
  /** A move mid-charge (e.g. a two-turn nuke). null = nothing charging. */
  pending: { abilityId: string; chargeTurnsLeft: number } | null
  /** Turns the combatant must skip (recharge after a big move). */
  recharge: number
  /** Net ATK modifier from self-buffs / enemy-debuffs (e.g. +0.25 = +25%). */
  atkMod: number
  /** Net DEF modifier. */
  defMod: number
}

export function emptyAbilityState(): AbilityBattleState {
  return { cooldowns: {}, usesLeft: {}, pending: null, recharge: 0, atkMod: 0, defMod: 0 }
}

/** Coerce untrusted JSONB (or null) into a well-formed AbilityBattleState. */
export function normalizeAbilityState(raw: unknown): AbilityBattleState {
  const s = (raw ?? {}) as Record<string, unknown>
  const asNumMap = (v: unknown): Record<string, number> => {
    if (!v || typeof v !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const n = Number(val)
      if (Number.isFinite(n)) out[k] = n
    }
    return out
  }
  const p = s.pending as { abilityId?: unknown; chargeTurnsLeft?: unknown } | null | undefined
  return {
    cooldowns: asNumMap(s.cooldowns),
    usesLeft: asNumMap(s.usesLeft),
    pending: p && typeof p.abilityId === 'string'
      ? { abilityId: p.abilityId, chargeTurnsLeft: Math.max(0, Number(p.chargeTurnsLeft) || 0) }
      : null,
    recharge: Math.max(0, Number(s.recharge) || 0),
    atkMod: Number(s.atkMod) || 0,
    defMod: Number(s.defMod) || 0,
  }
}

function cloneState(s: AbilityBattleState): AbilityBattleState {
  return {
    cooldowns: { ...s.cooldowns },
    usesLeft: { ...s.usesLeft },
    pending: s.pending ? { ...s.pending } : null,
    recharge: s.recharge,
    atkMod: s.atkMod,
    defMod: s.defMod,
  }
}

// ── Learn gate ───────────────────────────────────────────────────────────────

export interface LearnCheckInput {
  ability: Pick<Ability, 'min_level' | 'min_rarity' | 'allowed_elements'>
  element: Element
  rarity: Rarity
  playerLevel: number
  ownsToken: boolean
}
export interface LearnCheckResult { ok: boolean; reason: string | null }

const ELEMENT_LABEL: Record<string, string> = {
  fiamma: 'Fiamma', adriatico: 'Adriatico', bosco: 'Bosco', terra: 'Terra', armonia: 'Armonia',
}
const RARITY_LABEL_MIN: Record<Rarity, string> = {
  comune: 'Terrestre', non_comune: 'Arcaico', raro: 'Eroico',
  epico: 'Mostruoso', leggendario: 'Leggendario', mitologico: 'Mitologico',
}

/** Can this Daimon learn this ability? Returns a human reason when it cannot. */
export function canLearnAbility({ ability, element, rarity, playerLevel, ownsToken }: LearnCheckInput): LearnCheckResult {
  if (!ownsToken) return { ok: false, reason: 'Token non posseduto' }
  if (playerLevel < ability.min_level) return { ok: false, reason: `Richiede Lv. ${ability.min_level}` }
  if (ability.allowed_elements && ability.allowed_elements.length > 0 && !ability.allowed_elements.includes(element)) {
    const labels = ability.allowed_elements.map(e => ELEMENT_LABEL[e] ?? e).join(' / ')
    return { ok: false, reason: `Solo ${labels}` }
  }
  if (ability.min_rarity && RARITY_RANK[rarity] < RARITY_RANK[ability.min_rarity]) {
    return { ok: false, reason: `Rarità ${RARITY_LABEL_MIN[ability.min_rarity]}+` }
  }
  return { ok: true, reason: null }
}

// ── Usability (given current battle state) ──────────────────────────────────

export interface UsableResult { usable: boolean; reason: string | null }

/** Is the ability castable right now (cooldown / PP)? Charging moves bypass this. */
export function isAbilityUsable(ability: Ability, state: AbilityBattleState): UsableResult {
  const cd = state.cooldowns[ability.id] ?? 0
  if (cd > 0) return { usable: false, reason: `Ricarica ${cd}` }
  if (ability.max_uses != null) {
    const left = state.usesLeft[ability.id] ?? ability.max_uses
    if (left <= 0) return { usable: false, reason: 'Usi finiti' }
  }
  return { usable: true, reason: null }
}

// ── Cast resolution ─────────────────────────────────────────────────────────

export interface CastInput {
  ability: Ability
  casterElement: Element
  targetElement: Element
  casterAtk: number
  casterDef: number
  casterMaxHp: number
  casterHp: number
  /** Caster's active status (scottatura lowers outgoing damage). */
  casterStatus?: StatusEffect | null
  targetDef: number
  /** Target's active status (marchio raises incoming damage). */
  targetStatus?: StatusEffect | null
  state: AbilityBattleState
  /** Injectable RNG for tests. Defaults to Math.random. */
  rng?: () => number
}

export interface CastResult {
  /** 'charging' = move began/continued charging (no effect this turn). */
  phase: 'charging' | 'fired' | 'blocked'
  reason: string | null
  hits: number
  damagePerHit: number[]
  totalDamage: number
  missed: boolean
  isCrit: boolean
  elementMultiplier: number
  /** HP restored to the caster (heal_percent + lifesteal). */
  healToCaster: number
  /** Status inflicted on the target this cast (already rolled). */
  statusToTarget: StatusEffect | null
  /** Status applied to the caster this cast (deterministic). */
  selfStatus: StatusEffect | null
  /** Stat mods to ADD to the caster's state (self-buff). */
  buffs: { atk: number; def: number }
  /** Stat reductions to apply to the TARGET's state (enemy-debuff, positive magnitudes). */
  debuffs: { atk: number; def: number }
  nextState: AbilityBattleState
  animationKey: string
}

function rollHits(ability: Ability, rng: () => number): number {
  const lo = Math.max(1, Math.floor(ability.hits_min))
  const hi = Math.max(lo, Math.floor(ability.hits_max))
  if (hi === lo) return lo
  return lo + Math.floor(rng() * (hi - lo + 1))
}

function zeroResult(nextState: AbilityBattleState, animationKey: string, phase: CastResult['phase'], reason: string | null): CastResult {
  return {
    phase, reason, hits: 0, damagePerHit: [], totalDamage: 0, missed: false, isCrit: false,
    elementMultiplier: 1, healToCaster: 0, statusToTarget: null, selfStatus: null,
    buffs: { atk: 0, def: 0 }, debuffs: { atk: 0, def: 0 }, nextState, animationKey,
  }
}

/**
 * Resolve casting `ability`. Handles charge (two-turn), recharge, cooldown, PP,
 * accuracy, multi-hit damage, element/crit, status infliction, heal/lifesteal,
 * self-buff and enemy-debuff. Pure — mutates nothing; returns the next state.
 */
export function resolveAbilityCast(input: CastInput): CastResult {
  const rng = input.rng ?? Math.random
  const { ability } = input
  const state = cloneState(input.state)
  const isPending = state.pending?.abilityId === ability.id

  // Gate on cooldown/PP only for a fresh cast (a pending charge is committed).
  if (!isPending) {
    const usable = isAbilityUsable(ability, state)
    if (!usable.usable) return zeroResult(input.state, ability.animation_key, 'blocked', usable.reason)
  }

  // Charge handling: compute how many charge turns remain after this action.
  let chargeLeft: number
  if (isPending) {
    chargeLeft = Math.max(0, state.pending!.chargeTurnsLeft - 1)
  } else {
    chargeLeft = ability.charge_turns
  }
  if (chargeLeft > 0) {
    state.pending = { abilityId: ability.id, chargeTurnsLeft: chargeLeft }
    return zeroResult(state, ability.animation_key, 'charging', null)
  }

  // ── FIRE ──────────────────────────────────────────────────────────────────
  state.pending = null
  if (ability.max_uses != null) {
    const left = state.usesLeft[ability.id] ?? ability.max_uses
    state.usesLeft[ability.id] = Math.max(0, left - 1)
  }
  if (ability.cooldown > 0) state.cooldowns[ability.id] = ability.cooldown
  if (ability.recharge_turns > 0) state.recharge = ability.recharge_turns

  const result = zeroResult(state, ability.animation_key, 'fired', null)

  // Accuracy — rng in [0,1); accuracy 1 never misses.
  if (rng() >= ability.accuracy) {
    result.missed = true
    return result
  }

  // Damage (enemy-target, power > 0).
  if (ability.target === 'enemy' && ability.power > 0) {
    result.elementMultiplier = getElementMultiplier(input.casterElement, input.targetElement)
    const hits = rollHits(ability, rng)
    const atkPenalty = getAttackerDamageMultiplier(input.casterStatus)
    const incoming = getIncomingDamageMultiplier(input.targetStatus)
    result.isCrit = rng() < CRIT_CHANCE
    const critMult = result.isCrit ? CRIT_MULTIPLIER : 1
    for (let i = 0; i < hits; i++) {
      const dmg = calculateCombatDamage({
        attackerAtk: input.casterAtk,
        defenderDef: input.targetDef,
        attackMultiplier: ability.power * atkPenalty * critMult * incoming,
        elementMultiplier: result.elementMultiplier,
      })
      result.damagePerHit.push(dmg)
      result.totalDamage += dmg
    }
    result.hits = hits
  }

  // Heal (own max HP %) + lifesteal (% of damage dealt).
  if (ability.heal_percent > 0) result.healToCaster += Math.max(1, Math.round(input.casterMaxHp * ability.heal_percent))
  if (ability.lifesteal_percent > 0 && result.totalDamage > 0) {
    result.healToCaster += Math.max(1, Math.round(result.totalDamage * ability.lifesteal_percent))
  }

  // Status infliction on the target (rolled), self-status (deterministic).
  if (ability.status_effect && ability.target === 'enemy') {
    if (rng() < (ability.status_chance || 0)) result.statusToTarget = ability.status_effect
  }
  if (ability.self_status) result.selfStatus = ability.self_status

  // Self-buff / enemy-debuff (magnitudes; applied to the relevant state by caller).
  result.buffs = { atk: ability.buff_atk || 0, def: ability.buff_def || 0 }
  result.debuffs = { atk: ability.debuff_atk || 0, def: ability.debuff_def || 0 }

  return result
}

// ── Turn-start bookkeeping ──────────────────────────────────────────────────

/** Decrement cooldowns + recharge at the start of a combatant's turn. */
export function tickAbilityState(input: AbilityBattleState): { state: AbilityBattleState; recharging: boolean } {
  const state = cloneState(input)
  let recharging = false
  if (state.recharge > 0) { state.recharge -= 1; recharging = true }
  for (const key of Object.keys(state.cooldowns)) {
    const next = Math.max(0, state.cooldowns[key] - 1)
    if (next === 0) delete state.cooldowns[key]
    else state.cooldowns[key] = next
  }
  return { state, recharging }
}

/** Apply a combatant's accumulated stat mods to its base ATK/DEF. */
export function applyStatMods(atk: number, def: number, state: AbilityBattleState): { atk: number; def: number } {
  return {
    atk: Math.max(1, Math.round(atk * (1 + (state.atkMod || 0)))),
    def: Math.max(0, Math.round(def * (1 + (state.defMod || 0)))),
  }
}

/** Fold self-buff deltas into a combatant's own state (clamped to a sane range). */
export function addSelfBuffs(state: AbilityBattleState, buffs: { atk: number; def: number }): AbilityBattleState {
  const next = cloneState(state)
  next.atkMod = clampMod(next.atkMod + buffs.atk)
  next.defMod = clampMod(next.defMod + buffs.def)
  return next
}

/** Fold enemy-debuff deltas (positive magnitudes) into the TARGET's state. */
export function addEnemyDebuffs(state: AbilityBattleState, debuffs: { atk: number; def: number }): AbilityBattleState {
  const next = cloneState(state)
  next.atkMod = clampMod(next.atkMod - debuffs.atk)
  next.defMod = clampMod(next.defMod - debuffs.def)
  return next
}

function clampMod(v: number): number {
  return Math.max(-0.75, Math.min(2, v))
}
