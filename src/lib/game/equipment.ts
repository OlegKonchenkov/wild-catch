import type { SupabaseClient } from '@supabase/supabase-js'
import type { BaseCombatStats } from '@/lib/game/combat'
import type { EquipmentSlot } from '@/lib/types'

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['arma', 'corazza', 'elmo', 'accessorio']

export interface EquipmentSlotMeta {
  slot: EquipmentSlot
  label: string
  emoji: string
  color: string
}

export const EQUIPMENT_SLOT_META: Record<EquipmentSlot, EquipmentSlotMeta> = {
  arma:       { slot: 'arma',       label: 'Arma',       emoji: '🗡️', color: '#FB7185' },
  corazza:    { slot: 'corazza',    label: 'Corazza',    emoji: '🛡️', color: '#60A5FA' },
  elmo:       { slot: 'elmo',       label: 'Elmo',       emoji: '⛑️', color: '#FBBF24' },
  accessorio: { slot: 'accessorio', label: 'Accessorio', emoji: '💍', color: '#C084FC' },
}

export function isEquipmentSlot(value: string): value is EquipmentSlot {
  return (EQUIPMENT_SLOTS as string[]).includes(value)
}

const ZERO_BONUS: BaseCombatStats = { hp: 0, atk: 0, def: 0 }

/**
 * Aggregate equipment stat bonuses for the given owned-creature instances.
 * Returns a map keyed by player_creature_id; creatures with no gear get {0,0,0}.
 * One query, summed in memory.
 */
export async function getEquipmentBonuses(
  supabase: SupabaseClient,
  playerCreatureIds: string[],
): Promise<Map<string, BaseCombatStats>> {
  const result = new Map<string, BaseCombatStats>()
  const ids = playerCreatureIds.filter(Boolean)
  for (const id of ids) result.set(id, { ...ZERO_BONUS })
  if (ids.length === 0) return result

  // Defensive: if the creature_equipment table is unavailable (e.g. migration
  // 040 not yet applied) equipment simply contributes no bonus rather than
  // breaking combat. Combat must never fail because of optional gear data.
  type ItemBonus = { bonus_hp: number | null; bonus_atk: number | null; bonus_def: number | null }
  type RawRow = { player_creature_id: string; items: ItemBonus | ItemBonus[] | null }
  try {
    const { data } = await supabase
      .from('creature_equipment')
      .select('player_creature_id, items(bonus_hp, bonus_atk, bonus_def)')
      .in('player_creature_id', ids)

    for (const raw of (data ?? []) as unknown as RawRow[]) {
      const pcId = raw.player_creature_id
      // Supabase may return the joined row as an object or a single-element array.
      const it = Array.isArray(raw.items) ? raw.items[0] : raw.items
      const acc = result.get(pcId) ?? { ...ZERO_BONUS }
      acc.hp  += it?.bonus_hp  ?? 0
      acc.atk += it?.bonus_atk ?? 0
      acc.def += it?.bonus_def ?? 0
      result.set(pcId, acc)
    }
  } catch {
    // ignore — return zeroed bonuses
  }

  // Variante GOLD (Wave 3): +10% delle stats BASE della specie, come fosse un
  // equipaggiamento permanente. Un solo hook qui = vale in incontri, boss e
  // duelli senza toccare i singoli flussi di combattimento. Stessa filosofia
  // difensiva: se la colonna/join non c'è, il GOLD semplicemente non bonifica.
  try {
    type GoldRow = { id: string; is_gold: boolean | null; creatures: { hp: number; atk: number; def: number } | Array<{ hp: number; atk: number; def: number }> | null }
    const { data: goldRows } = await supabase
      .from('player_creatures')
      .select('id, is_gold, creatures(hp, atk, def)')
      .in('id', ids)
      .eq('is_gold', true)

    for (const raw of (goldRows ?? []) as unknown as GoldRow[]) {
      const base = Array.isArray(raw.creatures) ? raw.creatures[0] : raw.creatures
      if (!base) continue
      const acc = result.get(raw.id) ?? { ...ZERO_BONUS }
      acc.hp  += Math.round((base.hp  ?? 0) * 0.10)
      acc.atk += Math.round((base.atk ?? 0) * 0.10)
      acc.def += Math.round((base.def ?? 0) * 0.10)
      result.set(raw.id, acc)
    }
  } catch {
    // ignore — GOLD contributes nothing if unavailable
  }

  return result
}
