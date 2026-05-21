'use client'
import { motion } from 'framer-motion'

interface Props {
  /** Play the one-shot strike-in on mount (battle start). */
  struck?: boolean
  /** Accent color — gold by default, boss screens can override. */
  gold?: string
  /** Vertical position (% of scene) — sits on the seam between the two halves. */
  topPct?: number
}

// Jagged bolts in a 360×90 viewBox, centred on (180,45) = the VS core. Two
// strands per side + a short fork → forked, electric look. Indices 2 & 5 are forks.
const BOLTS = [
  'M180 45 L156 39 L138 49 L112 36 L86 47 L58 35 L30 45 L3 41',
  'M180 45 L150 51 L128 43 L100 53 L72 45 L44 54 L13 48',
  'M86 47 L74 61 L62 57',
  'M180 45 L204 39 L222 49 L248 36 L274 47 L302 35 L330 45 L357 41',
  'M180 45 L210 51 L232 43 L260 53 L288 45 L316 54 L347 48',
  'M274 47 L286 61 L298 57',
]
const isFork = (i: number) => i === 2 || i === 5

/**
 * Golden VS emblem with forked lightning arcing across the full width of the
 * seam. Two layers (blurred gold aura + hot white core) strike in on mount then
 * flicker. Purely decorative.
 */
export default function VsEmblem({ struck = true, gold = '#F7C841', topPct = 50 }: Props) {
  const boltAnim = (i: number) => ({
    initial: { pathLength: struck ? 0 : 1, opacity: struck ? 0 : 1 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.3, delay: struck ? 0.05 + i * 0.025 : 0, ease: 'easeOut' as const },
  })

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: 0, right: 0, top: `${topPct}%`, transform: 'translateY(-50%)', height: 120, zIndex: 9 }}
    >
      <svg width="100%" height="100%" viewBox="0 0 360 90" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <linearGradient id="vsGlow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={gold} stopOpacity="0" /><stop offset=".13" stopColor={gold} stopOpacity=".9" />
            <stop offset=".5" stopColor="#FFE9A8" /><stop offset=".87" stopColor={gold} stopOpacity=".9" /><stop offset="1" stopColor={gold} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vsCore" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".18" stopColor="#FFF6D6" /><stop offset=".5" stopColor="#fff" /><stop offset=".82" stopColor="#FFF6D6" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id="vsBlur" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="2.6" /></filter>
        </defs>

        {/* aura layer (blurred gold) */}
        <motion.g
          filter="url(#vsBlur)"
          animate={{ opacity: [0.85, 0.55, 0.9, 0.7, 0.85] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
        >
          {BOLTS.map((d, i) => (
            <motion.path key={i} d={d} fill="none" stroke="url(#vsGlow)" strokeWidth={isFork(i) ? 2.6 : 5} strokeLinecap="round" strokeLinejoin="round" {...boltAnim(i)} />
          ))}
        </motion.g>
        {/* hot core (crisp white) */}
        <motion.g
          animate={{ opacity: [1, 0.78, 1, 0.88, 1] }}
          transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
        >
          {BOLTS.map((d, i) => (
            <motion.path key={i} d={d} fill="none" stroke="url(#vsCore)" strokeWidth={isFork(i) ? 1 : 1.7} strokeLinecap="round" strokeLinejoin="round" {...boltAnim(i)} />
          ))}
        </motion.g>
      </svg>

      {/* persistent soft glow behind the ring */}
      <motion.div
        className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${gold}45, transparent 68%)`, filter: 'blur(7px)' }}
        animate={{ opacity: [0.55, 0.9, 0.55], scale: [0.9, 1.06, 0.9] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* VS ring */}
      <motion.div
        className="absolute flex items-center justify-center"
        style={{
          left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 74, height: 74, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 36%, rgba(32,36,44,.96), rgba(8,10,14,.85))',
          border: `1.5px solid ${gold}b0`,
          boxShadow: `0 0 36px ${gold}70, 0 6px 18px rgba(0,0,0,.55), inset 0 1px 0 ${gold}66, inset 0 0 18px ${gold}38`,
        }}
        initial={{ scale: struck ? 0.5 : 1, opacity: struck ? 0 : 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: struck ? 0.08 : 0, type: 'spring', stiffness: 320, damping: 15 }}
      >
        <span style={{ fontWeight: 800, fontSize: 28, color: gold, textShadow: `0 0 18px ${gold}c8, 0 1px 1px rgba(0,0,0,.6)`, letterSpacing: '-0.02em' }}>VS</span>
      </motion.div>
    </div>
  )
}
