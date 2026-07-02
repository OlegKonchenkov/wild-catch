'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GiCardboardBox } from 'react-icons/gi'
import { describeDrop } from './loot-visuals'
import { RARITY_COLORS } from '@/lib/types'
import type { Rarity } from '@/lib/types'

export interface PackDrop { type: string; ok: boolean; detail: Record<string, any> }
export interface OpenedPack { id?: string; name: string; image_url?: string | null; rarity?: string | null }

/**
 * Card-pack opening reveal. Three beats:
 *   1. sealed  — the foil pack floats; tap to tear it open
 *   2. burst   — a flash + shockwave as the seal rips
 *   3. reveal  — drops flip in one-by-one like trading cards, rarest last
 */
export default function PackOpenModal({
  pack, drops, onDone,
}: { pack: OpenedPack; drops: PackDrop[]; onDone: () => void }) {
  const [phase, setPhase] = useState<'sealed' | 'burst' | 'reveal'>('sealed')
  const packAccent = (pack.rarity && pack.rarity in RARITY_COLORS)
    ? RARITY_COLORS[pack.rarity as Rarity] : '#E8B54A'

  const tear = useCallback(() => {
    if (phase !== 'sealed') return
    setPhase('burst')
    setTimeout(() => setPhase('reveal'), 620)
  }, [phase])

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 40%, #16223dee 0%, #05070Ef7 70%)' }}>

      {/* Ambient rotating rays */}
      <motion.div aria-hidden className="absolute pointer-events-none"
        style={{
          width: 620, height: 620,
          background: `conic-gradient(from 0deg, transparent 0deg, ${packAccent}22 18deg, transparent 36deg, transparent 90deg, ${packAccent}18 108deg, transparent 126deg)`,
          filter: 'blur(2px)',
        }}
        animate={{ rotate: 360 }} transition={{ duration: 34, repeat: Infinity, ease: 'linear' }} />

      <AnimatePresence mode="wait">
        {/* ── Sealed pack ─────────────────────────────────────────────── */}
        {phase === 'sealed' && (
          <motion.button key="sealed" onClick={tear}
            className="relative flex flex-col items-center focus:outline-none"
            initial={{ scale: 0.7, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: [0, -10, 0] }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ scale: { type: 'spring', stiffness: 200, damping: 16 }, opacity: { duration: 0.3 }, y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } }}>
            <div className="relative rounded-[26px] overflow-hidden"
              style={{
                width: 214, height: 300,
                background: `linear-gradient(150deg, ${packAccent} 0%, #2A1C08 55%, ${packAccent}cc 100%)`,
                boxShadow: `0 22px 60px ${packAccent}55, inset 0 0 40px rgba(0,0,0,0.35)`,
                border: '2px solid rgba(255,255,255,0.35)',
              }}>
              {/* foil shimmer sweep */}
              <motion.div aria-hidden className="absolute inset-0"
                style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 48%, transparent 62%)' }}
                animate={{ x: ['-120%', '160%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.1, ease: 'easeInOut' }} />
              {pack.image_url
                ? <img src={pack.image_url} alt={pack.name} className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-70" />
                : <GiCardboardBox className="absolute inset-0 m-auto" size={120} color="#00000055" />}
              {/* wax seal */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
                style={{ width: 76, height: 76, background: 'radial-gradient(circle at 35% 30%, #C8352A, #6A130C)', boxShadow: '0 6px 18px rgba(0,0,0,0.5), inset 0 2px 6px rgba(255,255,255,0.3)' }}>
                <GiCardboardBox size={38} color="#F7E4C0" />
              </div>
              <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 6px rgba(255,255,255,0.08)', borderRadius: 26 }} />
            </div>
            <p className="mt-5 text-white font-extrabold text-lg tracking-wide">{pack.name}</p>
            <motion.p className="mt-1 text-white/55 text-sm font-semibold uppercase tracking-[0.2em]"
              animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.8, repeat: Infinity }}>
              Tocca per aprire
            </motion.p>
          </motion.button>
        )}

        {/* ── Burst flash ─────────────────────────────────────────────── */}
        {phase === 'burst' && (
          <motion.div key="burst" className="absolute inset-0 flex items-center justify-center" exit={{ opacity: 0 }}>
            <motion.div className="rounded-full"
              style={{ background: `radial-gradient(circle, #fff 0%, ${packAccent} 40%, transparent 72%)` }}
              initial={{ width: 40, height: 40, opacity: 0.9 }}
              animate={{ width: 900, height: 900, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }} />
            <motion.div className="absolute inset-0 bg-white"
              initial={{ opacity: 0 }} animate={{ opacity: [0, 0.85, 0] }} transition={{ duration: 0.5 }} />
          </motion.div>
        )}

        {/* ── Drop reveal ─────────────────────────────────────────────── */}
        {phase === 'reveal' && (
          <motion.div key="reveal" className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <div className="flex-1 overflow-y-auto px-5 pt-10 pb-4">
              <motion.h2 className="text-center text-white/90 font-extrabold text-xl mb-1"
                initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                Hai aperto {pack.name}
              </motion.h2>
              <motion.p className="text-center text-white/45 text-sm mb-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                {drops.length} ricompense
              </motion.p>

              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                {drops.map((d, i) => <DropCard key={i} drop={d} index={i} />)}
              </div>
            </div>

            <div className="px-5 pb-8 pt-2" style={{ background: 'linear-gradient(180deg, transparent, #05070E 40%)' }}>
              <motion.button onClick={onDone}
                className="w-full max-w-md mx-auto block py-4 rounded-2xl font-extrabold text-[#05070E] text-base"
                style={{ background: `linear-gradient(135deg, ${packAccent}, ${packAccent}bb)`, boxShadow: `0 6px 24px ${packAccent}55` }}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + drops.length * 0.14 }}
                whileTap={{ scale: 0.97 }}>
                Fantastico!
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DropCard({ drop, index }: { drop: PackDrop; index: number }) {
  const v = describeDrop(drop.type, drop.detail)
  const { Icon } = v
  return (
    <motion.div style={{ perspective: 800 }}
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.14, type: 'spring', stiffness: 220, damping: 18 }}>
      <motion.div className="relative rounded-2xl p-4 h-full flex flex-col items-center text-center"
        style={{
          transformStyle: 'preserve-3d',
          background: `linear-gradient(160deg, ${v.accent}22 0%, rgba(255,255,255,0.03) 100%)`,
          border: `1px solid ${v.accent}55`,
          boxShadow: `0 8px 26px ${v.accent}22, inset 0 0 20px ${v.accent}12`,
        }}
        initial={{ rotateY: 180 }} animate={{ rotateY: 0 }}
        transition={{ delay: 0.26 + index * 0.14, duration: 0.5, ease: 'easeOut' }}>
        <div className="relative mb-2 rounded-xl flex items-center justify-center"
          style={{ width: 62, height: 62, background: `radial-gradient(circle at 40% 30%, ${v.accent}44, transparent 70%)` }}>
          {v.imageUrl
            ? <img src={v.imageUrl} alt={v.title} className="w-14 h-14 object-contain rounded-lg" />
            : <Icon size={38} color={v.accent} style={{ filter: `drop-shadow(0 0 8px ${v.accent}88)` }} />}
        </div>
        <p className="text-white font-bold text-sm leading-tight line-clamp-2">{v.title}</p>
        {v.subtitle && (
          <span className="mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide capitalize"
            style={{ background: `${v.accent}22`, color: v.accent }}>
            {v.subtitle}
          </span>
        )}
      </motion.div>
    </motion.div>
  )
}
