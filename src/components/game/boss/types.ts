// Shared types + theme constants for the boss-fight screens.
// Used by both src/app/game/boss/[id]/page.tsx and the extracted view
// components (CreatureCard, SquadSelector, ResultScreen).

import type { Element, Rarity } from '@/lib/types'
import type { StatusEffect } from '@/lib/game/combat'

export interface BossSlot {
  slot: number
  creature_id: string
  name: string
  element: Element
  /** Creature rarity. Used to pick the matching attack animation (anim
   *  registry is keyed on element + rarity tier). Optional for
   *  back-compat with legacy boss_fights rows that pre-date this field. */
  rarity?: Rarity
  level?: number
  atk: number
  def?: number
  max_hp: number
  current_hp: number
  fainted: boolean
  image_url: string
  sprite_cutout_url?: string | null
  sprite_url: string
  active_status?: StatusEffect | null
  status_turns_left?: number
  status_effect?: StatusEffect | null
  status_effect_chance?: number
}

export interface PlayerSlot {
  slot: number
  player_creature_id: string
  name: string
  element: Element
  rarity: Rarity
  level?: number
  atk: number
  def?: number
  max_hp: number
  current_hp: number
  fainted: boolean
  is_active: boolean
  image_url: string
  sprite_cutout_url?: string | null
  sprite_url?: string | null
  attack_sound_url?: string | null
  attack_sound_duration_ms?: number | null
  active_status?: StatusEffect | null
  status_turns_left?: number
  status_effect?: StatusEffect | null
  status_effect_chance?: number
}

export interface SquadCreature {
  playerCreatureId: string
  name: string
  element: Element
  rarity: Rarity
  hp: number
  atk: number
  def: number
  image_url: string
  sprite_cutout_url?: string | null
  sprite_url?: string | null
}

export interface BattagliaItem {
  inventoryId: string
  name: string
  effectValue: number
  quantity: number
}

export interface CombatFortuneInfo {
  multiplier: number
  deltaPercent: number
  tone: 'lucky' | 'rough' | 'steady'
  label: string
  isUnderdog: boolean
}

// ── Element theme ──────────────────────────────────────────────────────────
export const ELEMENT_THEME: Record<string, { bg: string; glow: string; ground: string }> = {
  bosco:     { bg: '#030B05', glow: '#2ECC6A', ground: '#061408' },
  fiamma:    { bg: '#0D0305', glow: '#FF5520', ground: '#150505' },
  adriatico: { bg: '#020810', glow: '#00C4E8', ground: '#040C18' },
  terra:     { bg: '#0A0700', glow: '#D4A060', ground: '#120D02' },
  armonia:   { bg: '#08030F', glow: '#B060F8', ground: '#0E0518' },
}

export const DEFAULT_THEME = { bg: '#060C18', glow: '#3A9DBC', ground: '#080E1E' }
export const BOSS_THEME    = { bg: '#0D0205', glow: '#F7C841', ground: '#120309' }

export function formatFortuneText(fortune: CombatFortuneInfo | null | undefined): string | null {
  if (!fortune) return null
  if (fortune.deltaPercent === 0) return fortune.label
  const sign = fortune.deltaPercent > 0 ? '+' : ''
  return `${fortune.label} ${sign}${fortune.deltaPercent}%`
}
