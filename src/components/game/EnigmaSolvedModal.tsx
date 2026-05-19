'use client'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Celebration modal shown when the player correctly solves an enigma.
 * Replaces a tiny inline "Corretto! +5 oro" feedback string.
 *
 * Mirrors the silhouette of MissionRewardModal / TutorialPinClaimModal
 * (badge + label + title + reward rows + CTA) for visual consistency
 * across the post-action reward UX. Confetti pieces fan out to sell the
 * win — the enigma is the climactic moment of a session/tutorial arc.
 */
const CONFETTI_COLORS = ['#C084FC', '#38BDF8', '#FBBF24', '#34D399', '#F472B6']

interface Props {
  enigmaTitle: string
  solution: string
  reward?: { gold?: number; exp?: number }
  /** True iff this was the first time solving (vs a no-op replay). */
  fresh: boolean
  onClose: () => void
  ctaLabel?: string
}

function Confetti() {
  const pieces = Array.from({ length: 22 }, (_, i) => {
    const angle = -90 + (i - 10.5) * 7
    const distance = 110 + ((i * 47) % 80)
    const rad = (angle * Math.PI) / 180
    return {
      i,
      dx: Math.cos(rad) * distance,
      dy: Math.sin(rad) * distance,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rot: (i * 53) % 720 - 360,
      delay: (i % 7) * 0.04,
    }
  })
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {pieces.map(p => (
        <motion.span
          key={p.i}
          className="absolute block"
          style={{ width: 6, height: 10, borderRadius: 1, background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy + 80, opacity: 0, rotate: p.rot }}
          transition={{ duration: 1.6, delay: p.delay, ease: [0.2, 0.7, 0.3, 1] }}
        />
      ))}
    </div>
  )
}

export default function EnigmaSolvedModal({ enigmaTitle, solution, reward, fresh, onClose, ctaLabel }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9993] flex flex-col items-center justify-center px-6"
        style={{ background: 'rgba(2,4,12,0.95)', backdropFilter: 'blur(18px)' }}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.35 }}
      >
        {fresh && <Confetti />}

        {/* Glow */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 280, height: 280, background: 'radial-gradient(circle, rgba(192,132,252,0.25) 0%, transparent 70%)' }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        />

        {/* Badge */}
        <motion.div
          className="relative text-6xl mb-3"
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 16 }}
        >
          🧩
        </motion.div>

        {/* Label */}
        <motion.p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: 'rgba(192,132,252,0.85)' }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        >
          {fresh ? 'Enigma risolto' : 'Già risolto'}
        </motion.p>

        {/* Title */}
        <motion.h2
          className="text-center font-extrabold text-white text-xl mb-2 leading-snug max-w-xs"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          {enigmaTitle}
        </motion.h2>

        {/* Revealed solution — quoted, in palette */}
        <motion.div
          className="mb-5 px-4 py-2 rounded-full"
          style={{ background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.3)' }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        >
          <p className="text-[#C084FC] font-bold text-base italic">«{solution}»</p>
        </motion.div>

        {/* Rewards (only when actually awarded — first-time solve) */}
        {fresh && (reward?.exp || reward?.gold) && (
          <motion.div
            className="w-full max-w-xs flex flex-col gap-2.5 mb-6"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
          >
            {!!reward.exp && reward.exp > 0 && (
              <div className="flex items-center justify-between rounded-2xl px-5 py-3"
                style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)' }}>
                <span className="text-sm text-white/55">EXP</span>
                <span className="font-extrabold text-[#34D399] text-base">+{reward.exp} ⭐</span>
              </div>
            )}
            {!!reward.gold && reward.gold > 0 && (
              <div className="flex items-center justify-between rounded-2xl px-5 py-3"
                style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.22)' }}>
                <span className="text-sm text-white/55">Oro</span>
                <span className="font-extrabold text-[#FBBF24] text-base">+{reward.gold} 🪙</span>
              </div>
            )}
          </motion.div>
        )}

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
          onClick={onClose}
          whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-2xl font-extrabold text-white text-base max-w-xs"
          style={{ background: 'linear-gradient(135deg,#C084FC,#9333EA)', boxShadow: '0 4px 24px rgba(192,132,252,0.4)' }}
        >
          {ctaLabel ?? 'Continua'}
        </motion.button>
      </motion.div>
    </AnimatePresence>
  )
}
