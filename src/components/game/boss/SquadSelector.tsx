'use client'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import CreatureDiorama from '@/components/creature/CreatureDiorama'
import CreatureRosterRow from '@/components/game/CreatureRosterRow'
import { scaleCombatStats } from '@/lib/game/combat'
import { GameListSkeleton } from '@/components/game/GameLoading'
import type { BossSlot, SquadCreature } from '@/components/game/boss/types'

export default function SquadSelector({
  creatures,
  lineup,
  onToggle,
  onRemoveSlot,
  onConfirm,
  bossName,
  bossLineup,
  starting,
  playerLevel,
}: {
  creatures: SquadCreature[]
  lineup: (SquadCreature | null)[]
  onToggle: (c: SquadCreature) => void
  onRemoveSlot: (i: number) => void
  onConfirm: () => void
  bossName: string
  bossLineup: BossSlot[]
  starting: boolean
  playerLevel: number
}) {
  const filledCount = lineup.filter(Boolean).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(247,200,65,0.12)', border: '1px solid rgba(247,200,65,0.3)' }}
          >
            <span className="text-xl">💀</span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Capo Palestra</h1>
            <p className="text-white/40 text-xs">{bossName} ti sfida! Scegli la tua squadra</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {bossLineup.map((bc, i) => (
            <div
              key={i}
              className="flex-1 flex items-center gap-2 rounded-xl px-2 py-1.5"
              style={{ background: 'rgba(247,200,65,0.06)', border: '1px solid rgba(247,200,65,0.2)' }}
            >
              <CreatureDiorama creature={bc} size={30} rounded={8} anchor="center" showAura={false} className="w-8 h-8 shrink-0" sizes="64px" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-white/80 truncate">{bc.name}</p>
                <p className="text-[9px] text-white/35">{ELEMENT_EMOJI[bc.element]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Squad slots */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-semibold">
          La tua squadra ({filledCount}/3)
        </p>
        <div className="flex gap-2">
          {lineup.map((c, i) => (
            <button
              key={i}
              onClick={() => c && onRemoveSlot(i)}
              className="flex-1 rounded-xl border-2 transition-all overflow-hidden"
              style={{
                height: 64,
                borderColor: c ? 'rgba(58,157,188,0.6)' : 'rgba(255,255,255,0.12)',
                borderStyle: c ? 'solid' : 'dashed',
                background: c ? 'rgba(58,157,188,0.08)' : 'rgba(255,255,255,0.02)',
              }}
            >
              {c ? (
                <div className="flex items-center gap-1.5 h-full px-2">
                  <CreatureDiorama creature={c} size={34} rounded={10} anchor="center" showAura={false} className="w-9 h-9 shrink-0" sizes="80px" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-white truncate">{c.name}</p>
                    <p className="text-[9px]" style={{ color: RARITY_COLORS[c.rarity] }}>{c.rarity}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-white/20 text-2xl font-light">+</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Creature list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {creatures.map(c => {
          const inLineup = lineup.some(l => l?.playerCreatureId === c.playerCreatureId)
          const scaled = scaleCombatStats({ hp: c.hp, atk: c.atk, def: c.def }, playerLevel)
          return (
            <CreatureRosterRow
              key={c.playerCreatureId}
              creature={c}
              hp={scaled.hp}
              atk={scaled.atk}
              def={scaled.def}
              selected={inLineup}
              onClick={() => onToggle(c)}
            />
          )
        })}
      </div>

      {/* Confirm button */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <button
          onClick={onConfirm}
          disabled={filledCount < 1 || starting}
          className="w-full text-white font-extrabold py-3.5 rounded-xl text-sm transition-all disabled:opacity-40"
          style={{
            background: filledCount < 1 || starting
              ? 'rgba(255,255,255,0.08)'
              : 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)',
            boxShadow: filledCount >= 1 && !starting ? '0 4px 20px rgba(232,93,47,0.4)' : 'none',
          }}
        >
          {starting
            ? 'Inizio battaglia...'
            : filledCount < 1
              ? 'Seleziona almeno 1 creatura'
              : '⚔️ Inizia la battaglia!'}
        </button>
      </div>
    </div>
  )
}

export function SquadSelectorSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl shrink-0 animate-pulse"
            style={{ background: 'rgba(247,200,65,0.12)', border: '1px solid rgba(247,200,65,0.2)' }}
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-36 rounded bg-white/10 animate-pulse" />
            <div className="h-2.5 w-48 max-w-full rounded bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-xl px-2 py-1.5"
              style={{ background: 'rgba(247,200,65,0.05)', border: '1px solid rgba(247,200,65,0.15)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-2.5 w-4/5 rounded bg-white/10 animate-pulse" />
                  <div className="h-2 w-1/3 rounded bg-white/5 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <div className="h-3 w-28 rounded bg-white/10 animate-pulse mb-2" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.03]"
              style={{ height: 64 }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <GameListSkeleton rows={5} itemClassName="h-[72px]" />
      </div>

      <div className="p-4 border-t border-white/10 shrink-0">
        <div className="h-12 rounded-xl bg-white/10 animate-pulse" />
      </div>
    </div>
  )
}
