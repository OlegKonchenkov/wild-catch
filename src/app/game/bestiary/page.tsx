'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { RARITY_COLORS, ELEMENT_EMOJI } from '@/lib/types'
import type { Creature, PlayerCreature } from '@/lib/types'

const RARITY_ORDER = ['comune', 'non_comune', 'raro', 'epico', 'leggendario']
const MYSTERY_HINTS: Record<string, string> = {
  fiamma:    'Percepisci calore nelle vicinanze...',
  adriatico: 'Senti il profumo del mare...',
  bosco:     'Un fruscio tra le foglie...',
  terra:     'Il terreno vibra leggermente...',
  armonia:   'Un\'aura di pace nell\'aria...',
}

export default function BestiaryPage() {
  const [creatures, setCreatures]           = useState<Creature[]>([])
  const [playerCreatures, setPlayerCreatures] = useState<PlayerCreature[]>([])
  const [selected, setSelected]             = useState<{ creature: Creature; pc: PlayerCreature | null } | null>(null)
  const [message, setMessage]               = useState('')
  const [filter, setFilter]                 = useState<'all' | 'caught' | 'missing'>('all')
  const [loading, setLoading]               = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }

    let done = 0
    function finish() { if (++done === 2) setLoading(false) }

    supabase.from('creatures').select('*').order('rarity').then(({ data }) => {
      if (data) setCreatures(
        [...(data as unknown as Creature[])].sort(
          (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
        )
      )
      finish()
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { finish(); return }
      supabase
        .from('player_creatures')
        .select('*, creatures(*)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .then(({ data }) => { if (data) setPlayerCreatures(data as unknown as PlayerCreature[]); finish() })
    })
  }, [supabase])

  function getPc(creatureId: string) {
    return playerCreatures.find(pc => pc.creature_id === creatureId) ?? null
  }

  async function handleSelect(pc: PlayerCreature) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    const res = await fetch('/api/game/creature/select', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCreatureId: pc.id, sessionId }),
    })
    if (res.ok) {
      const name = creatures.find(c => c.id === pc.creature_id)?.name ?? 'Creatura'
      setMessage(`${name} selezionata come creatura attiva!`)
    }
  }

  async function handleEvolve(pc: PlayerCreature) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    const res = await fetch('/api/game/creature/evolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCreatureId: pc.id, sessionId }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(`✨ ${data.newCreature.name} si è evoluta!`)
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return
      const { data: refreshed } = await supabase
        .from('player_creatures').select('*, creatures(*)')
        .eq('user_id', user.id)
        .eq('session_id', localStorage.getItem('current_session_id')!)
      if (refreshed) setPlayerCreatures(refreshed as unknown as PlayerCreature[])
    } else {
      setMessage(data.error)
    }
  }

  const caughtCount = playerCreatures.length
  const filtered = creatures.filter(c => {
    if (filter === 'caught')  return !!getPc(c.id)
    if (filter === 'missing') return !getPc(c.id)
    return true
  })

  return (
    <div className="h-full overflow-y-auto">
      <style>{`
        .silhouette { filter: brightness(0.15) saturate(0) blur(0.5px) contrast(0.8); }
        .silhouette-soft { filter: brightness(0.12) saturate(0) blur(2px) contrast(0.7); }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .mystery-shimmer {
          background: linear-gradient(90deg, #0a1520 25%, #162030 50%, #0a1520 75%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A1520]/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white">Bestiario</h1>
            <p className="text-xs text-white/40 mt-0.5">
              <span className="text-[#3A9DBC] font-semibold">{caughtCount}</span>
              <span className="text-white/30"> / {creatures.length} scoperti</span>
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-24">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#3A9DBC] to-[#34D399] rounded-full transition-all"
                style={{ width: `${creatures.length ? (caughtCount / creatures.length) * 100 : 0}%` }} />
            </div>
            <p className="text-right text-xs text-white/30 mt-0.5">
              {creatures.length ? Math.round((caughtCount / creatures.length) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {([['all', 'Tutti'], ['caught', '✓ Catturati'], ['missing', '? Mancanti']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition-all ${
                filter === v ? 'bg-[#3A9DBC] text-white' : 'bg-white/5 text-white/40 hover:text-white/70'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {message && (
          <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="text-[#F7C841] text-sm text-center mb-4 bg-[#F7C841]/10 rounded-lg p-2">
            {message}
          </motion.p>
        )}

        {loading && (
          <div className="grid grid-cols-3 gap-2 pb-24">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/8 p-2 flex flex-col items-center gap-1.5"
                style={{ animationDelay: `${i * 60}ms` }}>
                <div className="w-14 h-14 rounded-lg bg-white/10 animate-pulse" />
                <div className="w-12 h-2.5 rounded bg-white/10 animate-pulse" />
                <div className="w-8 h-2 rounded bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!loading && <div className="grid grid-cols-3 gap-2 pb-24">
          {filtered.map((creature, i) => {
            const pc = getPc(creature.id)
            const caught = !!pc
            const rarityColor = RARITY_COLORS[creature.rarity]

            return (
              <motion.div
                key={creature.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => setSelected({ creature, pc })}
                className={`relative rounded-2xl overflow-hidden cursor-pointer border transition-all
                  ${caught
                    ? 'bg-gradient-to-b from-white/10 to-white/5 border-white/15 hover:border-white/30'
                    : 'mystery-shimmer border-white/5 hover:border-white/10'
                  }`}
              >
                {/* Rarity stripe */}
                <div className="h-0.5" style={{ background: caught ? rarityColor : 'transparent' }} />

                {/* Image area */}
                <div className="relative aspect-square overflow-hidden flex items-center justify-center p-1">
                  {creature.image_url ? (
                    <>
                      <Image
                        src={creature.image_url}
                        alt={caught ? creature.name : '???'}
                        width={80} height={80}
                        className={`w-full h-full object-contain transition-all ${caught ? '' : 'silhouette'}`}
                      />
                      {!caught && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#0A1520]/40 rounded-lg">
                          <span className="text-white/30 text-lg font-black">?</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={`text-3xl ${caught ? '' : 'opacity-10'}`}>
                      {caught ? ELEMENT_EMOJI[creature.element] : '?'}
                    </div>
                  )}

                  {/* Caught badge */}
                  {caught && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#34D399] flex items-center justify-center">
                      <span className="text-[9px] font-black text-white">✓</span>
                    </div>
                  )}

                  {/* Duplicate count */}
                  {pc && pc.duplicates_count > 1 && (
                    <div className="absolute top-1 left-1 bg-[#3A9DBC] text-white text-[9px] font-bold px-1 rounded">
                      ×{pc.duplicates_count}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className={`px-2 pb-2 text-center ${caught ? '' : 'opacity-40'}`}>
                  <p className="text-xs font-bold truncate" style={{ color: caught ? 'white' : '#666' }}>
                    {caught ? creature.name : '???'}
                  </p>
                  {caught && (
                    <p className="text-[9px] mt-0.5" style={{ color: rarityColor }}>
                      {ELEMENT_EMOJI[creature.element]}
                    </p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>}
      </div>

      {/* Detail bottom sheet */}
      <AnimatePresence>
        {selected && (() => {
          const { creature, pc } = selected
          const caught = !!pc
          const hint = MYSTERY_HINTS[creature.element] ?? 'Qualcosa si muove nell\'ombra...'

          return (
            <motion.div
              key="sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 bg-[#0F1F2E] border-t border-white/10 rounded-t-3xl z-50 pb-8"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              <button onClick={() => setSelected(null)}
                className="absolute top-4 right-4 text-white/30 hover:text-white/70 text-xl w-8 h-8 flex items-center justify-center">
                ✕
              </button>

              <div className="px-6 pt-2">
                {/* Image */}
                <div className="flex justify-center mb-4">
                  <div className="relative w-36 h-36">
                    {creature.image_url ? (
                      <>
                        <Image src={creature.image_url} alt={caught ? creature.name : '???'}
                          fill className={`object-contain ${caught ? '' : 'silhouette-soft'}`} sizes="144px" />
                        {!caught && (
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#0F1F2E]/30 via-[#0F1F2E]/20 to-[#0F1F2E]/50" />
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">
                        {caught ? ELEMENT_EMOJI[creature.element] : '?'}
                      </div>
                    )}
                  </div>
                </div>

                {caught ? (
                  /* ── CAUGHT: full info ── */
                  <>
                    <div className="text-center mb-4">
                      <h3 className="text-2xl font-bold text-white">{creature.name}</h3>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="text-sm">{ELEMENT_EMOJI[creature.element]}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: `${RARITY_COLORS[creature.rarity]}22`, color: RARITY_COLORS[creature.rarity] }}>
                          {creature.rarity.replace('_', ' ')}
                        </span>
                        {pc.duplicates_count > 1 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#3A9DBC]/20 text-[#3A9DBC]">
                            ×{pc.duplicates_count} duplicati
                          </span>
                        )}
                      </div>
                      {creature.description && (
                        <p className="text-sm text-white/50 mt-3 leading-relaxed">{creature.description}</p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      {[
                        { label: 'HP', value: creature.hp, color: '#F87171', emoji: '❤️' },
                        { label: 'ATK', value: creature.atk, color: '#FB923C', emoji: '⚔️' },
                        { label: 'DEF', value: creature.def, color: '#60A5FA', emoji: '🛡️' },
                      ].map(s => (
                        <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                          <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button onClick={() => handleSelect(pc)}
                        className="flex-1 bg-[#3A9DBC] text-white font-bold py-3.5 rounded-xl">
                        ⚔️ Usa in Battaglia
                      </button>
                      {pc.duplicates_count >= 3 && !pc.evolved && (
                        <button onClick={() => handleEvolve(pc)}
                          className="flex-1 bg-[#F7C841] text-[#0F1F2E] font-bold py-3.5 rounded-xl">
                          ✨ Evolvi
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  /* ── NOT CAUGHT: mystery view ── */
                  <>
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-white/20 tracking-widest">? ? ?</h3>
                      <p className="text-xs text-white/30 mt-2 italic">{hint}</p>
                    </div>

                    {/* Hidden stats */}
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      {['HP', 'ATK', 'DEF'].map(label => (
                        <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-white/15">—</p>
                          <p className="text-xs text-white/20 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Element hint only */}
                    <div className="bg-white/5 rounded-2xl p-4 text-center mb-5">
                      <p className="text-3xl mb-1">{ELEMENT_EMOJI[creature.element]}</p>
                      <p className="text-xs text-white/30">Elemento rilevato</p>
                    </div>

                    <div className="bg-[#E85D2F]/10 border border-[#E85D2F]/20 rounded-xl px-4 py-3 text-center">
                      <p className="text-sm font-bold text-[#E85D2F]">🎯 Catturala per scoprire tutto!</p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
