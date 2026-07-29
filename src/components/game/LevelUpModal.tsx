'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { GiRoundStar, GiTwoCoins, GiCardboardBox } from 'react-icons/gi'
import type { LevelRewardGrant } from '@/lib/game/level-rewards'

export interface LevelUpInfo {
  newLevel: number
  goldReward: number
  /** Rewards the organiser configured in `level_rewards` for the levels just
   *  crossed. Previously these were never granted at all, so there was nothing
   *  to show; now they have to be visible or the player gets items in silence. */
  rewards?: LevelRewardGrant[] | null
}

export default function LevelUpModal({
  info,
  onDismiss,
}: {
  info: LevelUpInfo | null
  onDismiss: () => void
}) {
  return (
    <AnimatePresence>
      {info && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={onDismiss}
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

          <motion.div
            className="absolute rounded-full border-2 border-[#F7C841]/20"
            initial={{ width: 0, height: 0, opacity: 1 }}
            animate={{ width: 500, height: 500, opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
          />
          <motion.div
            className="absolute rounded-full border border-[#F7C841]/30"
            initial={{ width: 0, height: 0, opacity: 1 }}
            animate={{ width: 380, height: 380, opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
          />

          <motion.div
            initial={{ scale: 0.4, y: 60, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="relative z-10 text-center px-10 py-8 rounded-3xl bg-[#0F1F2E]/90 border border-[#F7C841]/30"
            style={{ boxShadow: '0 0 60px rgba(247,200,65,0.25), 0 20px 60px rgba(0,0,0,0.6)' }}
          >
            <motion.div
              className="mb-3 flex justify-center"
              animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 0.6, delay: 0.25 }}
            >
              <GiRoundStar size={64} color="#F7C841" style={{ filter: 'drop-shadow(0 0 20px rgba(247,200,65,0.6))' }} />
            </motion.div>

            <p className="wc-display text-[#F7C841]/80 text-xs font-bold tracking-[0.25em] uppercase mb-1">
              Livello
            </p>

            <motion.p
              className="wc-display font-black text-white leading-none"
              style={{ fontSize: '5.5rem' }}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.15 }}
            >
              {info.newLevel}
            </motion.p>

            {info.goldReward > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4A96A]/15 border border-[#D4A96A]/30"
              >
                <GiTwoCoins size={20} color="#D4A96A" />
                <span className="text-[#D4A96A] font-bold text-lg">+{info.goldReward}</span>
              </motion.div>
            )}

            {(() => {
              const grants = (info.rewards ?? []).filter(
                r => r.gold > 0 || r.items.length > 0 || r.description,
              )
              if (grants.length === 0) return null
              const bonusGold = grants.reduce((sum, r) => sum + r.gold, 0)
              const items = grants.flatMap(r => r.items)
              return (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                  className="mt-4 pt-4 border-t border-white/10 text-left"
                >
                  <p className="wc-display text-[#F7C841]/70 text-[10px] font-bold tracking-[0.2em] uppercase mb-2 text-center">
                    Ricompensa di livello
                  </p>
                  {grants.map(r => r.description && (
                    <p key={`d-${r.level}`} className="text-white/60 text-xs text-center mb-2 leading-relaxed">
                      {r.description}
                    </p>
                  ))}
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {bonusGold > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D4A96A]/15 border border-[#D4A96A]/30">
                        <GiTwoCoins size={15} color="#D4A96A" />
                        <span className="text-[#D4A96A] font-bold text-sm">+{bonusGold}</span>
                      </span>
                    )}
                    {items.map((it, i) => (
                      <span
                        key={`${it.itemId}-${i}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/15"
                      >
                        <GiCardboardBox size={15} color="#E6C989" />
                        <span className="text-white/85 font-semibold text-sm">
                          {it.itemName ?? 'Oggetto'}{it.quantity > 1 ? ` ×${it.quantity}` : ''}
                        </span>
                      </span>
                    ))}
                  </div>
                </motion.div>
              )
            })()}

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-5 text-white/35 text-xs"
            >
              Tocca per continuare
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
