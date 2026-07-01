import { type CSSProperties } from 'react'
import { type IconType } from 'react-icons'
import {
  GiCrossedSwords, GiPoisonBottle, GiHealthNormal, GiUpgrade, GiShield,
} from 'react-icons/gi'
import { STATUS_EFFECT_META, type StatusEffect } from '@/lib/game/combat'
import type { Ability, AbilityCategory } from '@/lib/game/abilities'

/** Category → glyph + accent. Single source of truth for ability visuals. */
export const CATEGORY_META: Record<AbilityCategory, { label: string; Icon: IconType; color: string }> = {
  attacco:       { label: 'Attacco',       Icon: GiCrossedSwords, color: '#FB7185' },
  stato:         { label: 'Stato',         Icon: GiPoisonBottle,  color: '#C084FC' },
  cura:          { label: 'Cura',          Icon: GiHealthNormal,  color: '#34D399' },
  potenziamento: { label: 'Potenziamento', Icon: GiUpgrade,       color: '#FBBF24' },
  difesa:        { label: 'Difesa',        Icon: GiShield,        color: '#60A5FA' },
}

/** The accent colour for an ability: its explicit color, else its category colour. */
export function abilityAccent(a: Pick<Ability, 'color' | 'category'>): string {
  return a.color ?? CATEGORY_META[a.category]?.color ?? '#94A3B8'
}

export interface AbilityChip { label: string; color: string; key: string }

/** Compact, human-readable summary chips for an ability's mechanics. */
export function buildAbilityChips(a: Ability): AbilityChip[] {
  const chips: AbilityChip[] = []
  const pct = (n: number) => `${Math.round(n * 100)}%`

  if (a.power > 0) chips.push({ key: 'pow', label: `⚔ ×${a.power}`, color: '#FB923C' })
  if (a.hits_max > 1) chips.push({ key: 'hits', label: `${a.hits_min}–${a.hits_max} colpi`, color: '#F59E0B' })
  if (a.priority > 0) chips.push({ key: 'prio', label: '⚡ Priorità', color: '#FBBF24' })
  if (a.status_effect) {
    const m = STATUS_EFFECT_META[a.status_effect as StatusEffect]
    chips.push({ key: 'st', label: `${m.emoji} ${m.label} ${pct(a.status_chance)}`, color: m.color })
  }
  if (a.self_status) {
    const m = STATUS_EFFECT_META[a.self_status as StatusEffect]
    chips.push({ key: 'self', label: `${m.emoji} ${m.label}`, color: m.color })
  }
  if (a.heal_percent > 0) chips.push({ key: 'heal', label: `💚 +${pct(a.heal_percent)} HP`, color: '#34D399' })
  if (a.lifesteal_percent > 0) chips.push({ key: 'ls', label: `🩸 Assorbe ${pct(a.lifesteal_percent)}`, color: '#F87171' })
  if (a.buff_atk > 0) chips.push({ key: 'batk', label: `ATK ▲ ${pct(a.buff_atk)}`, color: '#FB923C' })
  if (a.buff_def > 0) chips.push({ key: 'bdef', label: `DIF ▲ ${pct(a.buff_def)}`, color: '#60A5FA' })
  if (a.debuff_atk > 0) chips.push({ key: 'datk', label: `ATK ▼ ${pct(a.debuff_atk)}`, color: '#F472B6' })
  if (a.debuff_def > 0) chips.push({ key: 'ddef', label: `DIF ▼ ${pct(a.debuff_def)}`, color: '#F472B6' })
  if (a.charge_turns > 0) chips.push({ key: 'chg', label: `🌀 Carica ${a.charge_turns}`, color: '#A78BFA' })
  if (a.recharge_turns > 0) chips.push({ key: 'rch', label: `♻ Recupero ${a.recharge_turns}`, color: '#94A3B8' })
  if (a.cooldown > 0) chips.push({ key: 'cd', label: `⏳ Ricarica ${a.cooldown}`, color: '#94A3B8' })
  if (a.max_uses != null) chips.push({ key: 'pp', label: `${a.max_uses} usi`, color: '#94A3B8' })
  if (a.accuracy < 1) chips.push({ key: 'acc', label: `🎯 ${pct(a.accuracy)}`, color: '#94A3B8' })
  return chips
}

/** A rounded, tinted square holding the ability's icon (art or category glyph). */
export function AbilityGlyph({
  ability, size = 22, style,
}: {
  ability: Pick<Ability, 'category' | 'color' | 'icon_url' | 'name'>
  size?: number
  style?: CSSProperties
}) {
  const accent = abilityAccent(ability)
  if (ability.icon_url) {
    return <img src={ability.icon_url} alt="" width={size} height={size} className="object-contain" style={style} />
  }
  const Icon = CATEGORY_META[ability.category]?.Icon ?? GiCrossedSwords
  return <Icon size={size} color={accent} style={{ filter: `drop-shadow(0 1px 2px ${accent}66)`, ...style }} />
}
