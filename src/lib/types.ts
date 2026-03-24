export type Element = 'fiamma' | 'adriatico' | 'bosco' | 'terra' | 'armonia'
export type Rarity = 'comune' | 'non_comune' | 'raro' | 'epico' | 'leggendario'
export type SessionStatus = 'draft' | 'ready' | 'active' | 'ended'
export type ItemType = 'rete' | 'esca' | 'uovo' | 'battaglia'
export type QRCodeType = 'uovo' | 'indizio' | 'oggetto' | 'boss' | 'evento'
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
  last_position: { x: number; y: number } | null
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
}

export interface QRCode {
  id: string
  session_id: string
  type: QRCodeType
  payload: Record<string, unknown>
  uses_remaining: number | null
  label: string
  created_at: string
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

// Element type chart: attacker element -> multiplier for defender
export const ELEMENT_MULTIPLIERS: Record<Element, Partial<Record<Element, number>>> = {
  fiamma: { bosco: 1.5, adriatico: 0.5, terra: 0.5 },
  adriatico: { fiamma: 1.5, terra: 1.5, bosco: 0.5 },
  bosco: { adriatico: 1.5, fiamma: 0.5 },
  terra: { fiamma: 1.5, adriatico: 0.5 },
  armonia: {},  // +15% base damage against all handled separately
}

export const RARITY_CATCH_RATES: Record<Rarity, number> = {
  comune: 0.70,
  non_comune: 0.45,
  raro: 0.25,
  epico: 0.12,
  leggendario: 0.05,
}

export const RARITY_COLORS: Record<Rarity, string> = {
  comune: '#7AB87A',
  non_comune: '#4A9FD4',
  raro: '#E8A820',
  epico: '#7B4DB8',
  leggendario: '#C8352A',
}

export const ELEMENT_EMOJI: Record<Element, string> = {
  fiamma: '🔥',
  adriatico: '🌊',
  bosco: '🌿',
  terra: '⛰️',
  armonia: '🎵',
}
