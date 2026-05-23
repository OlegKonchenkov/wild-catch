'use client'
import { type ReactNode } from 'react'
import CreatureDiorama from '@/components/creature/CreatureDiorama'
import { RARITY_COLORS } from '@/lib/types'

interface CreatureLike {
  element: string
  name: string
  rarity: string
  sprite_cutout_url?: string | null
  sprite_url?: string | null
  image_url?: string | null
}

const STATS = [
  { key: 'hp', label: 'HP', color: '#F87171' },
  { key: 'atk', label: 'ATK', color: '#FB923C' },
  { key: 'def', label: 'DEF', color: '#60A5FA' },
] as const

/**
 * A picked-lineup slot showed as a full-bleed element *diorama*: the real
 * per-element scene + the creature cutout fill the tile, with the name and
 * stat chips overlaid inside the image (over a bottom scrim). Rarity is used
 * only as the accent border/glow + #N badge — never as the background.
 * Shared by the duel lobby + boss (Capo Palestra) SquadSelector.
 */
export default function CreatureLineupSlot({
  creature, index, hp, atk, def, onRemove, emptyHint,
}: {
  creature: CreatureLike | null
  index: number
  hp?: number
  atk?: number
  def?: number
  onRemove?: () => void
  emptyHint?: ReactNode
}) {
  if (!creature) {
    return (
      <div
        className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-1"
        style={{ minHeight: 120, border: '2px dashed rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.02)' }}
      >
        <span className="text-2xl text-white/15 font-light leading-none">+</span>
        <span className="text-[9px] text-white/25">{emptyHint ?? `Slot ${index}`}</span>
      </div>
    )
  }

  const rc = RARITY_COLORS[creature.rarity as keyof typeof RARITY_COLORS] ?? '#9CA3AF'
  const vals: Record<string, number | undefined> = { hp, atk, def }
  const hasStats = hp != null || atk != null || def != null

  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex-1 relative rounded-2xl overflow-hidden transition-all active:scale-[0.97]"
      style={{
        minHeight: 120,
        border: `2px solid ${rc}80`,
        boxShadow: `0 0 18px ${rc}2e, inset 0 0 12px ${rc}10`,
      }}
    >
      {/* Full-bleed element diorama — big crisp cutout (low glow + large sizes) */}
      <CreatureDiorama
        creature={creature}
        size={102}
        aspect="auto"
        anchor="bottom"
        showAura={false}
        glow={0.5}
        rounded={0}
        sizes="320px"
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* #N badge */}
      <span
        className="absolute top-1.5 left-1.5 z-10 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md leading-none"
        style={{ color: '#06121a', background: rc, boxShadow: '0 1px 4px rgba(0,0,0,0.45)' }}
      >#{index}</span>

      {/* Bottom scrim + name + lightweight stats overlaid on the image */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 px-1.5 pt-5 pb-1.5"
        style={{ background: 'linear-gradient(to top, rgba(3,6,11,0.92) 0%, rgba(3,6,11,0.6) 52%, transparent 100%)' }}
      >
        <p className="text-[11px] font-extrabold text-white truncate text-center leading-tight" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{creature.name}</p>
        {hasStats && (
          <div className="flex items-center justify-center gap-2 mt-0.5">
            {STATS.map(s => vals[s.key] != null && (
              <span
                key={s.key}
                className="text-[8px] font-bold leading-none"
                style={{ color: s.color, textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
              >
                {s.label} {vals[s.key]}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
