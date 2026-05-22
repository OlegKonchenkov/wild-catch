'use client'
import { type ReactNode } from 'react'
import CreatureDiorama from '@/components/creature/CreatureDiorama'
import { RARITY_COLORS, RARITY_LABELS, ELEMENT_EMOJI } from '@/lib/types'

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
 * Shared roster row for picking a creature into a lineup — used by both the
 * duel "Crea Sfida" picker and the boss (Capo Palestra) SquadSelector so the
 * two stay identical. A bigger element diorama thumbnail + name + rarity/element
 * + stat chips + a clear add/selected affordance.
 */
export default function CreatureRosterRow({
  creature, hp, atk, def, selected = false, selectedBadge, addable = true, accent, onClick,
}: {
  creature: CreatureLike
  hp: number
  atk: number
  def: number
  selected?: boolean
  /** shown in the right-side pill when selected (e.g. slot number); defaults to ✓ */
  selectedBadge?: ReactNode
  /** when false and not selected, the row is dimmed + non-interactive (lineup full) */
  addable?: boolean
  /** accent color — defaults to the rarity color */
  accent?: string
  onClick?: () => void
}) {
  const rc = RARITY_COLORS[creature.rarity as keyof typeof RARITY_COLORS] ?? '#9CA3AF'
  const ac = accent ?? rc
  const interactive = selected || addable
  const vals = { hp, atk, def }

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 border text-left transition-all active:scale-[0.985]"
      style={{
        background: selected ? `${ac}1c` : 'rgba(255,255,255,0.035)',
        borderColor: selected ? `${ac}85` : 'rgba(255,255,255,0.08)',
        boxShadow: selected ? `0 0 18px ${ac}26, inset 0 1px 0 rgba(255,255,255,0.05)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        opacity: interactive ? 1 : 0.4,
      }}
    >
      <CreatureDiorama
        creature={creature}
        size={52}
        anchor="bottom"
        showAura={false}
        rounded={14}
        sizes="140px"
        className="shrink-0"
        style={{ width: 62, height: 62, border: `1px solid ${rc}3a` }}
      />

      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-white text-[15px] leading-tight truncate">{creature.name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: rc, background: `${rc}1f`, border: `1px solid ${rc}55` }}>
            {RARITY_LABELS[creature.rarity as keyof typeof RARITY_LABELS]}
          </span>
          <span className="text-[12px] leading-none">{ELEMENT_EMOJI[creature.element as keyof typeof ELEMENT_EMOJI]}</span>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          {STATS.map(s => (
            <span key={s.key} className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: s.color, background: `${s.color}14`, border: `1px solid ${s.color}26` }}>
              {s.label} {vals[s.key]}
            </span>
          ))}
        </div>
      </div>

      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm"
        style={selected
          ? { background: ac, color: '#06121a' }
          : addable
            ? { border: `1.5px solid ${ac}66`, color: ac, background: `${ac}12` }
            : { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.2)' }}
      >
        {selected ? (selectedBadge ?? '✓') : addable ? '+' : ''}
      </div>
    </button>
  )
}
