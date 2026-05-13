'use client'
import { ELEMENT_EMOJI, RARITY_COLORS, RARITY_LABELS } from '@/lib/types'
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
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0" style={{ background: 'rgba(247,200,65,0.1)' }}>
                {bc.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bc.image_url} alt={bc.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base">
                    {ELEMENT_EMOJI[bc.element] ?? '?'}
                  </div>
                )}
              </div>
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
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0" style={{ background: `${RARITY_COLORS[c.rarity]}18` }}>
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-base">
                        {ELEMENT_EMOJI[c.element]}
                      </div>
                    )}
                  </div>
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
            <button
              key={c.playerCreatureId}
              onClick={() => onToggle(c)}
              className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition-all"
              style={{
                borderColor: inLineup ? 'rgba(58,157,188,0.5)' : 'rgba(255,255,255,0.07)',
                background:  inLineup ? 'rgba(58,157,188,0.08)' : 'rgba(255,255,255,0.03)',
              }}
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0" style={{ background: `${RARITY_COLORS[c.rarity]}18` }}>
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">
                    {ELEMENT_EMOJI[c.element]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-bold text-white text-sm truncate">{c.name}</p>
                <p className="text-xs" style={{ color: RARITY_COLORS[c.rarity] }}>{RARITY_LABELS[c.rarity]}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {([
                  { label: 'HP',  val: scaled.hp,  color: '#F87171' },
                  { label: 'ATK', val: scaled.atk, color: '#FB923C' },
                  { label: 'DEF', val: scaled.def, color: '#60A5FA' },
                ] as const).map(s => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center rounded-lg px-1.5 py-1 min-w-[32px]"
                    style={{ background: `${s.color}12`, border: `1px solid ${s.color}22` }}
                  >
                    <span className="text-[11px] font-black leading-none" style={{ color: s.color }}>{s.val}</span>
                    <span className="text-[8px] font-bold text-white/35 leading-none mt-0.5">{s.label}</span>
                  </div>
                ))}
              </div>
              {inLineup && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(58,157,188,0.2)', border: '1px solid rgba(58,157,188,0.5)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3A9DBC" strokeWidth="2.5" strokeLinecap="round" className="w-3 h-3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
            </button>
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
