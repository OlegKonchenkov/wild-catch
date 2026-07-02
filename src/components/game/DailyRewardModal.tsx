'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GiLaurelCrown, GiSun } from 'react-icons/gi'
import { describeDrop } from './loot-visuals'

export interface DailyDrop { type: string; ok: boolean; detail: Record<string, any> }

/**
 * Daily login reward — "un nuovo giorno d'avventura".
 * Visual identity: dawn light over laurels (warm ambers on the game's dark
 * navy), deliberately distinct from the treasure-foil PackOpenModal. Two
 * beats: greet (streak flames + claim button) → reveal (drops cascade).
 */
export default function DailyRewardModal({
  streak, day, onClaim, onDone,
}: {
  /** Streak the player HOLDS before claiming (0 = broken/first time). */
  streak: number
  /** Giorno N dell'avventura (personal, from join date). */
  day: number
  /** Performs the claim; resolves with the granted drops + new streak. */
  onClaim: () => Promise<{ streak: number; drops: DailyDrop[] } | null>
  onDone: () => void
}) {
  const [phase, setPhase] = useState<'greet' | 'claiming' | 'reveal'>('greet')
  const [drops, setDrops] = useState<DailyDrop[]>([])
  const [newStreak, setNewStreak] = useState(streak)
  const [error, setError] = useState<string | null>(null)

  async function claim() {
    if (phase !== 'greet') return
    setPhase('claiming')
    const res = await onClaim()
    if (!res) { setError('Riscossione non riuscita — riprova più tardi'); setPhase('greet'); return }
    setNewStreak(res.streak)
    setDrops(res.drops.filter(d => d.ok))
    setPhase('reveal')
  }

  // 7-day flame row = position within the weekly cycle. Before the claim the
  // held streak's flames are lit and the NEXT one pulses; after the claim the
  // new streak's flames are lit.
  const cycleOf = (s: number) => (s <= 0 ? 0 : ((s - 1) % 7) + 1)
  const litCount = phase === 'reveal' ? cycleOf(newStreak) : cycleOf(streak)
  const todayIndex = phase === 'reveal' ? -1 : litCount % 7 // flame about to be lit

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center px-5"
      style={{ background: 'radial-gradient(120% 90% at 50% 108%, #3a2a10ee 0%, #0a1420f2 46%, #05070Ef7 100%)' }}>

      {/* dawn glow */}
      <motion.div aria-hidden className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ width: 560, height: 300, background: 'radial-gradient(ellipse at 50% 100%, rgba(255,183,77,0.28) 0%, transparent 65%)' }}
        animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }} />

      <motion.div className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(175deg, #14233a 0%, #0B1626 60%, #0d1424 100%)', border: '1px solid rgba(255,183,77,0.28)', boxShadow: '0 24px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,220,150,0.12)' }}
        initial={{ y: 40, opacity: 0, scale: 0.94 }} animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 190, damping: 20 }}>

        {/* header */}
        <div className="relative px-5 pt-6 pb-4 text-center" style={{ background: 'linear-gradient(180deg, rgba(255,183,77,0.14), transparent)' }}>
          <motion.div className="inline-flex items-center justify-center rounded-full mb-2"
            style={{ width: 54, height: 54, background: 'radial-gradient(circle at 40% 30%, #FFD98A, #E8901A)', boxShadow: '0 0 26px rgba(255,183,77,0.55)' }}
            animate={{ y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
            <GiSun size={30} color="#5A3606" />
          </motion.div>
          <h2 className="text-white font-extrabold text-xl leading-tight">Un nuovo giorno d&apos;avventura</h2>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,214,150,0.75)' }}>Giorno {day} · la tua ricompensa ti aspetta</p>
        </div>

        {/* streak flames — weekly cycle of 7 */}
        <div className="px-5 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Serie di giorni</span>
            <span className="text-[12px] font-extrabold" style={{ color: '#FFB36B' }}>🔥 {phase === 'reveal' ? newStreak : streak}</span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }, (_, i) => {
              const lit = i < litCount
              const isToday = i === todayIndex
              return (
                <motion.div key={i} className="flex-1 rounded-lg flex flex-col items-center py-1.5"
                  style={{
                    background: lit ? 'rgba(255,138,60,0.16)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${lit ? 'rgba(255,138,60,0.45)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                  animate={isToday && phase !== 'reveal' ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 1.4, repeat: Infinity }}>
                  <span className="text-sm" style={{ filter: lit ? 'none' : 'grayscale(1) opacity(0.3)' }}>🔥</span>
                  <span className="text-[9px] font-bold mt-0.5" style={{ color: lit ? '#FFB36B' : 'rgba(255,255,255,0.25)' }}>{i + 1}</span>
                </motion.div>
              )
            })}
          </div>
          <p className="text-[10px] text-white/30 mt-1.5 text-center">Ogni 7 giorni consecutivi: bustina bonus!</p>
        </div>

        {/* body */}
        <div className="px-5 pb-6 pt-3">
          <AnimatePresence mode="wait">
            {phase !== 'reveal' ? (
              <motion.div key="greet" exit={{ opacity: 0, y: -8 }}>
                {error && <p className="text-xs text-red-300 text-center mb-2">{error}</p>}
                <motion.button onClick={claim} disabled={phase === 'claiming'}
                  className="w-full py-4 rounded-2xl font-extrabold text-base"
                  style={{ background: 'linear-gradient(135deg, #FFC46B, #E8901A)', color: '#3A2306', boxShadow: '0 6px 26px rgba(232,144,26,0.45)' }}
                  whileTap={{ scale: 0.97 }}>
                  {phase === 'claiming' ? 'Riscossione…' : 'Riscuoti la ricompensa'}
                </motion.button>
                <button onClick={onDone} className="w-full mt-2 py-2 text-xs font-semibold text-white/35">Più tardi</button>
              </motion.div>
            ) : (
              <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  <GiLaurelCrown size={16} color="#FFB36B" />
                  <p className="text-sm font-bold" style={{ color: '#FFD9A0' }}>Ricompense del giorno</p>
                  <GiLaurelCrown size={16} color="#FFB36B" style={{ transform: 'scaleX(-1)' }} />
                </div>
                <div className="space-y-2 mb-4">
                  {drops.map((d, i) => {
                    const v = describeDrop(d.type, d.detail)
                    const { Icon } = v
                    return (
                      <motion.div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                        style={{ background: `linear-gradient(120deg, ${v.accent}1c, rgba(255,255,255,0.02))`, border: `1px solid ${v.accent}45` }}
                        initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.18, type: 'spring', stiffness: 240, damping: 20 }}>
                        <div className="rounded-lg flex items-center justify-center shrink-0"
                          style={{ width: 40, height: 40, background: `radial-gradient(circle at 40% 30%, ${v.accent}3d, transparent 75%)` }}>
                          <Icon size={24} color={v.accent} style={{ filter: `drop-shadow(0 0 6px ${v.accent}77)` }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm leading-tight">{v.title}</p>
                          {v.subtitle && <p className="text-[11px] capitalize" style={{ color: v.accent }}>{v.subtitle}</p>}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                <motion.button onClick={onDone}
                  className="w-full py-3.5 rounded-2xl font-extrabold text-sm"
                  style={{ background: 'linear-gradient(135deg, #FFC46B, #E8901A)', color: '#3A2306', boxShadow: '0 6px 22px rgba(232,144,26,0.4)' }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + drops.length * 0.18 }}
                  whileTap={{ scale: 0.97 }}>
                  A domani! 🔥
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
