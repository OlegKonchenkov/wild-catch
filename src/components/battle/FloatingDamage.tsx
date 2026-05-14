'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * Floating combat number — pops out of a creature when it takes damage or
 * heals, rises, fades. Adds the missing "game feel" of every hit being
 * physically registered on the screen.
 *
 * Usage: render at the target's position, mount with a unique key per
 * event so a new instance triggers each time:
 *
 *   <FloatingDamage key={hitId} value={42} kind="damage" />
 *
 * The component auto-unmounts via `onComplete` after ~1.2s.
 */
export type FloatingDamageKind = 'damage' | 'heal' | 'crit' | 'miss'

interface Props {
  /** Numeric value to show. Negative numbers are coerced to absolute. */
  value: number
  kind?: FloatingDamageKind
  /** Optional positioning override (relative to parent). Default center-top. */
  x?: number | string
  y?: number | string
  /** Fired when the animation finishes — caller can clear the slot. */
  onComplete?: () => void
}

const STYLE_BY_KIND: Record<FloatingDamageKind, { color: string; shadow: string; size: number; prefix: string }> = {
  damage: { color: '#EF4444', shadow: '0 2px 8px rgba(239,68,68,0.55), 0 0 18px rgba(239,68,68,0.4)', size: 32, prefix: '−' },
  heal:   { color: '#34D399', shadow: '0 2px 8px rgba(52,211,153,0.55), 0 0 18px rgba(52,211,153,0.4)', size: 32, prefix: '+' },
  crit:   { color: '#FBBF24', shadow: '0 2px 10px rgba(251,191,36,0.7), 0 0 28px rgba(251,191,36,0.55)', size: 44, prefix: '−' },
  miss:   { color: 'rgba(255,255,255,0.55)', shadow: 'none', size: 22, prefix: '' },
}

export default function FloatingDamage({
  value,
  kind = 'damage',
  x = '50%',
  y = '38%',
  onComplete,
}: Props) {
  const [visible, setVisible] = useState(true)
  const meta = STYLE_BY_KIND[kind]
  const display = kind === 'miss' ? 'Miss' : `${meta.prefix}${Math.abs(Math.round(value))}`

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      // Give the exit animation time to play before unmounting upstream
      const u = setTimeout(() => onComplete?.(), 220)
      return () => clearTimeout(u)
    }, 950)
    return () => clearTimeout(t)
  }, [onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 0, opacity: 0, scale: kind === 'crit' ? 0.4 : 0.7 }}
          animate={{ y: -70, opacity: [0, 1, 1, 0], scale: kind === 'crit' ? [0.4, 1.3, 1.05] : 1 }}
          exit={{ opacity: 0, y: -90 }}
          transition={{
            duration: 1.0,
            times: kind === 'crit' ? [0, 0.18, 0.42] : [0, 0.12, 0.78, 1],
            ease: 'easeOut',
          }}
          className="absolute pointer-events-none select-none font-black tracking-tight"
          style={{
            left: x,
            top: y,
            transform: 'translate(-50%, -50%)',
            color: meta.color,
            textShadow: meta.shadow,
            fontSize: meta.size,
            lineHeight: 1,
            zIndex: 50,
            WebkitTextStroke: kind === 'crit' ? '1.5px rgba(0,0,0,0.55)' : '1px rgba(0,0,0,0.45)',
          }}
        >
          {display}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
