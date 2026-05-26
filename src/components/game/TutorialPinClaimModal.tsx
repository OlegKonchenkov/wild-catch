'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { GiLightBulb, GiPuzzle } from 'react-icons/gi'

/**
 * Reward modal shown after the player walks to the tutorial "Maestro" pin
 * on the map and claims the bonus enigma suggerimento. Replaces a tiny
 * top-of-screen toast that several testers missed entirely.
 *
 * Mirrors MissionRewardModal's silhouette (badge + label + title + payoff
 * row + CTA) so it reads as "a real reward screen" to the player.
 */
interface Props {
  alreadyClaimed: boolean
  onClose: () => void
}

export default function TutorialPinClaimModal({ alreadyClaimed, onClose }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9993] flex flex-col items-center justify-center px-6"
        style={{ background: 'rgba(2,4,12,0.94)', backdropFilter: 'blur(18px)' }}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Glow ring — cyan to differentiate from MissionRewardModal's amber */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 220, height: 220, background: 'radial-gradient(circle, rgba(56,189,248,0.22) 0%, transparent 70%)' }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        />

        {/* Badge */}
        <motion.div
          className="relative mb-4"
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
        >
          <GiLightBulb size={52} color="#38BDF8" style={{ filter: 'drop-shadow(0 0 18px rgba(56,189,248,0.55))' }} />
        </motion.div>

        {/* Label */}
        <motion.p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: 'rgba(56,189,248,0.8)' }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        >
          {alreadyClaimed ? 'Indizio già raccolto' : 'Indizio bonus sbloccato'}
        </motion.p>

        {/* Title */}
        <motion.h2
          className="wc-display text-center font-extrabold text-white text-xl mb-2 leading-snug"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          {alreadyClaimed
            ? 'Già ottenuto in precedenza'
            : 'Ottimo lavoro!'}
        </motion.h2>

        {/* Subline */}
        <motion.p
          className="text-center text-white/55 text-sm leading-relaxed mb-6 max-w-xs"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        >
          {alreadyClaimed
            ? 'Questo suggerimento è già nella tua sezione Enigmi.'
            : 'Hai raggiunto il punto del Maestro e raccolto un nuovo suggerimento. Lo trovi nella sezione Enigmi del menu.'}
        </motion.p>

        {/* Reward row */}
        <motion.div
          className="w-full flex items-center gap-3 rounded-2xl px-5 py-3 mb-6 max-w-xs"
          style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)' }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        >
          <GiPuzzle size={24} color="#38BDF8" style={{ filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.5))' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white/50 uppercase tracking-wider">Suggerimento</p>
            <p className="font-bold text-[#38BDF8] text-sm">Indizio Bonus del Maestro</p>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          onClick={onClose}
          whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-2xl font-extrabold text-white text-base max-w-xs"
          style={{ background: 'linear-gradient(135deg,#38BDF8,#0EA5E9)', boxShadow: '0 4px 24px rgba(56,189,248,0.35)' }}
        >
          Continua
        </motion.button>
      </motion.div>
    </AnimatePresence>
  )
}
