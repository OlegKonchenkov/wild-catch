'use client'
import { motion, AnimatePresence } from 'framer-motion'

export interface LevelUpInfo {
  newLevel: number
  goldReward: number
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
              className="text-6xl mb-3"
              animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 0.6, delay: 0.25 }}
            >
              ⭐
            </motion.div>

            <p className="text-[#F7C841]/80 text-xs font-bold tracking-[0.25em] uppercase mb-1">
              Livello
            </p>

            <motion.p
              className="font-black text-white leading-none"
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
                <span className="text-lg">💰</span>
                <span className="text-[#D4A96A] font-bold text-lg">+{info.goldReward}</span>
              </motion.div>
            )}

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
