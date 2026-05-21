'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'

export type BurstKind = 'damage' | 'crit' | 'poison' | 'heal'

interface Props {
  amount: number
  kind?: BurstKind
  target: 'enemy' | 'player'
  /** Optional flavour line under a crit, e.g. "Colpo critico! ×1.75". */
  label?: string
  /** Fired ~0.9s in so the caller can clear the slot. Mount with a unique key per hit. */
  onComplete?: () => void
}

const STYLE: Record<BurstKind, { color: string; splat: string; size: number; prefix: string; shadow: string }> = {
  damage: { color: '#fff', splat: 'rgba(193,58,43,.55)', size: 54, prefix: '−', shadow: '0 0 18px rgba(193,58,43,.9),0 2px 8px rgba(0,0,0,.8)' },
  crit: { color: '#F7C841', splat: 'rgba(240,206,122,.6)', size: 72, prefix: '−', shadow: '0 0 26px rgba(240,206,122,.95),0 0 54px rgba(240,206,122,.5),0 2px 10px #000' },
  poison: { color: '#4ADE80', splat: 'rgba(74,222,128,.5)', size: 46, prefix: '−', shadow: '0 0 16px rgba(74,222,128,.8),0 2px 8px rgba(0,0,0,.8)' },
  heal: { color: '#34D399', splat: 'rgba(52,211,153,.45)', size: 48, prefix: '+', shadow: '0 0 16px rgba(52,211,153,.8),0 2px 8px rgba(0,0,0,.8)' },
}

/**
 * The impact number that lands on a struck combatant: a radial splat blooms
 * behind a bold rising number. Crits are gold and oversized. The screen pairs a
 * crit with scene `freeze` + a micro screen-shake; this component is the visual.
 */
export default function DamageBurst({ amount, kind = 'damage', target, label, onComplete }: Props) {
  const s = STYLE[kind]
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), 900)
    return () => clearTimeout(t)
  }, [onComplete])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2"
      style={{ top: target === 'enemy' ? '28%' : '62%', transform: 'translateX(-50%)', zIndex: 9, textAlign: 'center' }}
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.15, 1], opacity: [0, 0.9, 0] }}
        transition={{ duration: 0.7, times: [0, 0.3, 1], ease: 'easeOut' }}
        style={{
          position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-50%)', zIndex: -1,
          width: kind === 'crit' ? 210 : 150, height: kind === 'crit' ? 210 : 150, borderRadius: '50%',
          background: `radial-gradient(circle, ${s.splat}, transparent 62%)`, filter: 'blur(4px)',
        }}
      />
      <motion.div
        initial={{ y: 10, opacity: 0, scale: kind === 'crit' ? 0.5 : 0.7 }}
        animate={{ y: -54, opacity: [0, 1, 1, 0], scale: kind === 'crit' ? [0.5, 1.3, 1.05] : 1 }}
        transition={{ duration: 0.9, times: kind === 'crit' ? [0, 0.18, 0.42, 1] : [0, 0.12, 0.78, 1], ease: 'easeOut' }}
        style={{ fontWeight: 800, fontSize: s.size, lineHeight: 1, color: s.color, textShadow: s.shadow, WebkitTextStroke: kind === 'crit' ? '1.5px rgba(0,0,0,.5)' : '1px rgba(0,0,0,.45)' }}
      >
        {s.prefix}{Math.abs(Math.round(amount))}
      </motion.div>
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: [0, 1, 0], y: -8 }} transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ marginTop: 6, fontStyle: 'italic', fontWeight: 700, fontSize: 13, color: '#F0CE7A' }}
        >
          {label}
        </motion.div>
      )}
    </div>
  )
}
