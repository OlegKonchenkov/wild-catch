'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { TutorialMoment } from '@/lib/game/tutorial'

/**
 * Narrative beat shown after a major tutorial mission completes — the
 * "maestro Daimologo" speaks to the player to explain what just
 * happened, what to do next, and (on the final moment) close the
 * apprenticeship. Fires AFTER MissionRewardModal drains so we don't
 * stack two modals at the same time.
 *
 * Each moment is dedup'd via localStorage so revisiting a completed
 * mission (e.g. via the bell history) doesn't replay the modal.
 */
const SEEN_KEY = 'wc:tutorial-moments-seen:v1'

function readSeen(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function markSeen(key: string) {
  if (typeof window === 'undefined') return
  try {
    const cur = readSeen()
    cur[key] = true
    localStorage.setItem(SEEN_KEY, JSON.stringify(cur))
  } catch { /* quota */ }
}

export function hasSeenTutorialMoment(key: string): boolean {
  return !!readSeen()[key]
}

export function clearTutorialMomentsSeen() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(SEEN_KEY) } catch { /* noop */ }
}

interface Props {
  moment: TutorialMoment | null
  onClose: () => void
}

export default function TutorialMomentModal({ moment, onClose }: Props) {
  const router = useRouter()
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!moment) return
    setClosing(false)
  }, [moment])

  if (!moment) return null

  const finalize = () => {
    if (closing) return
    setClosing(true)
    markSeen(moment.key)
    onClose()
  }

  const onCta = () => {
    if (moment.cta) {
      markSeen(moment.key)
      onClose()
      router.push(moment.cta.route)
      return
    }
    finalize()
  }

  const celebrate = !!moment.celebrate

  return (
    <AnimatePresence>
      <motion.div
        key={`tutorial-moment-${moment.key}`}
        className="fixed inset-0 z-[1200] flex flex-col items-center justify-center px-6"
        style={{ background: 'rgba(2,4,12,0.96)', backdropFilter: 'blur(20px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Aura glow for celebrate variant */}
        {celebrate && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 340, height: 340,
              background: 'radial-gradient(circle, rgba(251,191,36,0.28) 0%, transparent 70%)',
            }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
          />
        )}

        {/* Emoji */}
        <motion.div
          className="relative mb-4"
          style={{ fontSize: celebrate ? 84 : 64, lineHeight: 1 }}
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 16 }}
        >
          {moment.emoji}
        </motion.div>

        {/* Optional uppercase label for celebrate variant */}
        {celebrate && (
          <motion.p
            className="text-[11px] font-bold tracking-[0.25em] uppercase mb-2"
            style={{ color: 'rgba(251,191,36,0.85)' }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          >
            Tutorial completato
          </motion.p>
        )}

        {/* Title */}
        <motion.h2
          className="text-center font-extrabold text-white mb-5 leading-snug"
          style={{ fontSize: celebrate ? 26 : 22, maxWidth: 360 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          {moment.title}
        </motion.h2>

        {/* Body */}
        <motion.p
          className="text-center text-white/75 text-[15px] leading-relaxed whitespace-pre-line mb-7"
          style={{ maxWidth: 360 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
        >
          {moment.body}
        </motion.p>

        {/* CTA */}
        <motion.div
          className="w-full max-w-sm flex flex-col gap-2"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        >
          <motion.button
            onClick={onCta}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
            style={{
              background: celebrate
                ? 'linear-gradient(135deg,#FBBF24,#F59E0B,#E85D2F)'
                : 'linear-gradient(135deg,#3A9DBC,#2d7a99)',
              boxShadow: celebrate
                ? '0 6px 32px rgba(251,191,36,0.45)'
                : '0 4px 20px rgba(58,157,188,0.35)',
            }}
          >
            {moment.cta?.label ?? 'Continua'}
          </motion.button>
          {moment.cta && (
            <button
              onClick={finalize}
              className="text-white/40 text-xs font-semibold hover:text-white/70 transition-colors py-2"
            >
              Resta sulla mappa
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
