export type EnigmaDifficulty = 'facile' | 'medio' | 'difficile'

export type Element = 'fiamma' | 'adriatico' | 'bosco' | 'terra' | 'armonia'
export type Rarity = 'comune' | 'non_comune' | 'raro' | 'epico' | 'leggendario' | 'mitologico'
export type SessionStatus = 'draft' | 'ready' | 'active' | 'ended'
export type ItemType = 'rete' | 'esca' | 'uovo' | 'battaglia' | 'pozione' | 'cura'
export type QRCodeType = 'uovo' | 'indizio' | 'oggetto' | 'boss' | 'evento' | 'creatura'
export type EncounterStatus = 'active' | 'caught' | 'fled' | 'fought'
export type DuelStatus = 'waiting' | 'active' | 'ended'
export type PlayerRole = 'player' | 'boss' | 'villain'

export interface NarrativeConfig {
  story_title: string
  intro_text: string
  villain_name: string
  chapters: Array<{ order: number; title: string; description: string }>
}

export interface Creature {
  id: string
  name: string
  description: string
  element: Element
  rarity: Rarity
  hp: number
  atk: number
  def: number
  min_level: number
  image_url: string
  sprite_url: string
  lottie_url: string | null
  spawn_weight: number
  evolution_of: string | null
  catch_difficulty: number
  session_id: string | null
  enigma_title: string | null
  enigma_description: string | null
  enigma_image_url: string | null
  enigma_video_url: string | null
  enigma_frammento_id: string | null
}

export interface EnigmaFrammento {
  id: string
  enigma_id: string
  title: string
  description: string | null
  image_url: string | null
  video_url: string | null
  order_index: number
  created_at: string
}

export interface EnigmaSuggerimento {
  id: string
  enigma_id: string
  text: string
  image_url: string | null
  order_index: number
  created_at: string
}

export interface Enigma {
  id: string
  session_id: string
  title: string
  description: string | null
  solution: string
  difficulty: EnigmaDifficulty
  reward_type: 'exp' | 'gold' | 'oggetto' | 'creatura' | null
  reward_payload: Record<string, unknown> | null
  created_at: string
  frammenti?: EnigmaFrammento[]
  suggerimenti?: EnigmaSuggerimento[]
}

export interface Session {
  id: string
  name: string
  status: SessionStatus
  area_bounds: { north: number; south: number; east: number; west: number }
  duration_minutes: number
  start_at: string | null
  end_at: string | null
  auto_end: boolean
  narrative_config: NarrativeConfig
  created_at: string
}

export interface SessionInvite {
  id: string
  session_id: string
  code: string
  used_by_user_id: string | null
  used_at: string | null
  is_active: boolean
}

export interface PlayerSession {
  id: string
  user_id: string
  session_id: string
  level: number
  exp: number
  gold: number
  role: PlayerRole
  last_position: { lat: number; lng: number } | null
  score_final: number | null
  selected_creature_id: string | null
  joined_at: string
}

export interface PlayerCreature {
  id: string
  user_id: string
  creature_id: string
  session_id: string
  duplicates_count: number
  evolved: boolean
  caught_at: string
  creature?: Creature
}

export interface Item {
  id: string
  name: string
  type: ItemType
  effect_value: number
  description: string
  shop_price: number
}

export interface PlayerInventory {
  id: string
  user_id: string
  session_id: string
  item_id: string
  quantity: number
  item?: Item
}

export interface Encounter {
  id: string
  user_id: string
  creature_id: string
  session_id: string
  status: EncounterStatus
  trigger: 'gps' | 'timer'
  wild_creature_hp: number
  player_creature_id: string | null
  started_at: string
  resolved_at: string | null
}

export interface Duel {
  id: string
  challenger_id: string
  opponent_id: string | null
  session_id: string
  status: DuelStatus
  winner_id: string | null
  challenger_creature_id: string
  opponent_creature_id: string | null
  room_code: string
  started_at: string
  ended_at: string | null
}

export interface Mission {
  id: string
  session_id: string
  chapter_order: number
  title: string
  description: string
  type: string
  target: string
  target_count: number
  reward_gold: number
  reward_exp: number
  reward_item_id: string | null
  is_required: boolean
  unlock_level: number | null
  unlock_after_mission_id: string | null
}

export interface QRCode {
  id: string
  session_id: string
  type: QRCodeType
  payload: Record<string, unknown>
  uses_remaining: number | null
  label: string
  created_at: string
  enigma_suggerimento_id: string | null
}

export interface HallOfFame {
  id: string
  user_id: string
  session_id: string
  rank: number
  score: number
  creatures_caught: number
  season_label: string
  awarded_at: string
}

export interface PlayerMission {
  id: string
  user_id: string
  mission_id: string
  progress: number
  completed_at: string | null
  mission?: Mission
}

// Element type chart: attacker element -> multiplier for defender
// 🔥 Fiamma   → forte su 🌳 Bosco
// 💧 Adriatico → forte su 🔥 Fiamma
// 🌳 Bosco    → forte su 🪨 Terra
// 🪨 Terra    → forte su 💧 Adriatico
// ✨ Armonia   → forte su tutti, nessuna debolezza
export const ELEMENT_MULTIPLIERS: Record<Element, Partial<Record<Element, number>>> = {
  fiamma:    { bosco: 1.5 },
  adriatico: { fiamma: 1.5 },
  bosco:     { terra: 1.5 },
  terra:     { adriatico: 1.5 },
  armonia:   { fiamma: 1.5, adriatico: 1.5, bosco: 1.5, terra: 1.5 },
}

export const RARITY_CATCH_RATES: Record<Rarity, number> = {
  comune: 0.70,
  non_comune: 0.45,
  raro: 0.25,
  epico: 0.12,
  leggendario: 0.05,
  mitologico: 0.0125,
}

// Multiplier applied to the rarity base catch rate based on catch_difficulty (1–5 stars).
// 3⭐ = Normale = ×1.0 (no change). Lower difficulty = easier to catch.
export const CATCH_DIFFICULTY_MULT: Record<number, number> = {
  1: 1.50,  // Molto facile
  2: 1.20,  // Facile
  3: 1.00,  // Normale
  4: 0.70,  // Difficile
  5: 0.45,  // Molto difficile
}

export const RARITY_COLORS: Record<Rarity, string> = {
  comune: '#7AB87A',
  non_comune: '#4A9FD4',
  raro: '#E8A820',
  epico: '#7B4DB8',
  leggendario: '#C8352A',
  mitologico: '#FF4D6D',
}

export const RARITY_LABELS: Record<Rarity, string> = {
  comune: 'Terrestre',
  non_comune: 'Arcaico',
  raro: 'Eroico',
  epico: 'Mostruoso',
  leggendario: 'Leggendario',
  mitologico: 'Mitologico',
}

export const ELEMENT_EMOJI: Record<Element, string> = {
  fiamma: '🔥',
  adriatico: '🌊',
  bosco: '🌿',
  terra: '⛰️',
  armonia: '🎵',
}
