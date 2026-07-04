'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GiLockedChest, GiOpenChest, GiKeyring } from 'react-icons/gi'
import { describeDrop } from './loot-visuals'
import { RARITY_COLORS } from '@/lib/types'
import type { Rarity } from '@/lib/types'
import { playChestUnlock, playDropReveal } from '@/lib/game/sounds/pack-open'
import { playUiTap } from '@/lib/game/sounds/ui'
import { RARITY_RANK } from '@/lib/types'

export interface ChestDrop { type: string; ok: boolean; detail: Record<string, any> }
export interface OpenedChest { id?: string; name: string; image_url?: string | null; rarity?: string | null }

/**
 * Chest opening reveal. The chest sits locked; tapping turns the key, the lid
 * bursts open, and the (deterministic) contents rise out one by one.
 */
export default function ChestOpenModal({
  chest, contents, onDone,
}: { chest: OpenedChest; contents: ChestDrop[]; onDone: () => void }) {
  const [phase, setPhase] = useState<'locked' | 'unlocking' | 'reveal'>('locked')
  const accent = (chest.rarity && chest.rarity in RARITY_COLORS)
    ? RARITY_COLORS[chest.rarity as Rarity] : '#D97706'

  const isChestEpicPlus = !!chest.rarity && chest.rarity in RARITY_RANK
    && RARITY_RANK[chest.rarity as Rarity] >= RARITY_RANK.epico

  const unlock = useCallback(() => {
    if (phase !== 'locked') return
    playChestUnlock(chest.rarity)
    setPhase('unlocking')
    setTimeout(() => setPhase('reveal'), 900)
  }, [phase, chest.rarity])

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 42%, #211603ee 0%, #05070Ef7 72%)' }}>

      <motion.div aria-hidden className="absolute pointer-events-none rounded-full" data-testid={isChestEpicPlus ? 'chest-unlock-boost' : undefined}
        style={{ width: 460, height: 460, background: `radial-gradient(circle, ${accent}${isChestEpicPlus ? '33' : '22'} 0%, transparent 68%)` }}
        animate={{ scale: phase === 'reveal' ? [1, 1.15, 1] : (isChestEpicPlus ? [1, 1.08, 1] : 1), opacity: phase === 'locked' ? 0.5 : 0.9 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />

      <AnimatePresence mode="wait">
        {phase !== 'reveal' && (
          <motion.button key="chest" onClick={unlock} disabled={phase === 'unlocking'}
            className="relative flex flex-col items-center focus:outline-none"
            initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
            <motion.div
              animate={phase === 'unlocking'
                ? { rotate: [0, -4, 4, -3, 3, 0], y: [0, -6, 0, -4, 0] }
                : { y: [0, -8, 0] }}
              transition={phase === 'unlocking'
                ? { duration: 0.9 }
                : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
              {phase === 'unlocking'
                ? <GiOpenChest size={150} color={accent} style={{ filter: `drop-shadow(0 0 30px ${accent})` }} />
                : <GiLockedChest size={150} color={accent} style={{ filter: `drop-shadow(0 0 20px ${accent}bb)` }} />}
            </motion.div>
            {phase === 'unlocking' && (
              <motion.div className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.6, opacity: [0, 1, 0] }} transition={{ duration: 0.9 }}>
                <GiKeyring size={54} color="#F7E4C0" />
              </motion.div>
            )}
            <p className="mt-5 text-white font-extrabold text-lg tracking-wide">{chest.name}</p>
            {phase === 'locked' && (
              <motion.p className="mt-1 text-white/55 text-sm font-semibold uppercase tracking-[0.2em]"
                animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.8, repeat: Infinity }}>
                Tocca per aprire
              </motion.p>
            )}
          </motion.button>
        )}

        {phase === 'reveal' && (
          <motion.div key="reveal" className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex-1 overflow-y-auto px-5 pt-10 pb-4">
              <motion.h2 className="text-center text-white/90 font-extrabold text-xl mb-1"
                initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                {chest.name}
              </motion.h2>
              <motion.p className="text-center text-white/45 text-sm mb-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                Bottino trovato
              </motion.p>
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                {contents.map((d, i) => {
                  const v = describeDrop(d.type, d.detail)
                  const { Icon } = v
                  const isEpicPlus = !!v.rarity && RARITY_RANK[v.rarity] >= RARITY_RANK.epico
                  return (
                    <motion.div key={i}
                      className="relative rounded-2xl p-4 flex flex-col items-center text-center"
                      style={{ background: `linear-gradient(160deg, ${v.accent}22, rgba(255,255,255,0.03))`, border: `1px solid ${v.accent}55` }}
                      initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      onAnimationStart={() => playDropReveal(v.rarity)}
                      transition={{ delay: 0.15 + i * 0.14, type: 'spring', stiffness: 220, damping: 17 }}>
                      {isEpicPlus && (
                        <motion.div aria-hidden data-testid="drop-rarity-burst"
                          className="absolute inset-0 rounded-2xl pointer-events-none"
                          style={{ background: `radial-gradient(circle, ${v.accent}66 0%, transparent 70%)` }}
                          initial={{ scale: 0.4, opacity: 0.9 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          transition={{ delay: 0.15 + i * 0.14, duration: 0.35, ease: 'easeOut' }} />
                      )}
                      {v.rarity === 'mitologico' && (
                        <motion.div aria-hidden data-testid="mitologico-flash"
                          className="fixed inset-0 pointer-events-none z-[1210]"
                          style={{ background: 'radial-gradient(circle at 50% 45%, #FFD76699 0%, transparent 70%)' }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.9, 0] }}
                          transition={{ delay: 0.15 + i * 0.14, duration: 0.35, ease: 'easeOut' }} />
                      )}
                      <div className="mb-2 rounded-xl flex items-center justify-center"
                        style={{ width: 62, height: 62, background: `radial-gradient(circle at 40% 30%, ${v.accent}44, transparent 70%)` }}>
                        {v.imageUrl
                          ? <img src={v.imageUrl} alt={v.title} className="w-14 h-14 object-contain rounded-lg" />
                          : <Icon size={38} color={v.accent} style={{ filter: `drop-shadow(0 0 8px ${v.accent}88)` }} />}
                      </div>
                      <p className="text-white font-bold text-sm leading-tight line-clamp-2">{v.title}</p>
                      {v.subtitle && (
                        <span className="mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide capitalize"
                          style={{ background: `${v.accent}22`, color: v.accent }}>{v.subtitle}</span>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
            <div className="px-5 pb-8 pt-2" style={{ background: 'linear-gradient(180deg, transparent, #05070E 40%)' }}>
              <motion.button onClick={() => { playUiTap(); onDone() }}
                className="w-full max-w-md mx-auto block py-4 rounded-2xl font-extrabold text-[#05070E] text-base"
                style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, boxShadow: `0 6px 24px ${accent}55` }}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + contents.length * 0.14 }} whileTap={{ scale: 0.97 }}>
                Continua
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
