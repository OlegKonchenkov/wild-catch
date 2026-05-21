'use client'
import { motion } from 'framer-motion'

interface Props {
  /** Play the one-shot strike-in on mount (battle start). */
  struck?: boolean
  /** Accent color - gold by default, boss screens can override. */
  gold?: string
  /** Vertical position (% of scene) - sits on the seam between the two halves. */
  topPct?: number
}

const BOLTS: Array<{ d: string; fork?: boolean }> = [
  { d: 'M210 55 L184 46 L166 58 L140 43 L112 54 L82 40 L52 54 L22 48 L0 53' },
  { d: 'M210 55 L178 64 L151 53 L126 67 L98 58 L69 70 L38 60 L7 66' },
  { d: 'M210 55 L188 37 L160 35 L132 27 L108 35 L82 26 L56 34 L28 29' },
  { d: 'M210 55 L236 46 L254 58 L280 43 L308 54 L338 40 L368 54 L398 48 L420 53' },
  { d: 'M210 55 L242 64 L269 53 L294 67 L322 58 L351 70 L382 60 L413 66' },
  { d: 'M210 55 L232 37 L260 35 L288 27 L312 35 L338 26 L364 34 L392 29' },
  { d: 'M112 54 L96 82 L77 73', fork: true },
  { d: 'M151 53 L138 76 L120 71', fork: true },
  { d: 'M69 70 L56 91 L39 83', fork: true },
  { d: 'M308 54 L324 82 L343 73', fork: true },
  { d: 'M269 53 L282 76 L300 71', fork: true },
  { d: 'M351 70 L364 91 L381 83', fork: true },
]

const SPARKS = [
  { cx: 166, cy: 58, r: 2.2 },
  { cx: 254, cy: 58, r: 2.2 },
  { cx: 112, cy: 54, r: 1.8 },
  { cx: 308, cy: 54, r: 1.8 },
  { cx: 52, cy: 54, r: 1.3 },
  { cx: 368, cy: 54, r: 1.3 },
]

/**
 * Golden VS emblem with forked lightning arcing across the full seam.
 * Decorative only: blurred gold aura, hot white core, flickering sparks.
 */
export default function VsEmblem({ struck = true, gold = '#F7C841', topPct = 50 }: Props) {
  const boltAnim = (i: number) => ({
    initial: { pathLength: struck ? 0 : 1, opacity: struck ? 0 : 1 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.42, delay: struck ? 0.03 + i * 0.018 : 0, ease: 'easeOut' as const },
  })

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: 0, right: 0, top: `${topPct}%`, transform: 'translateY(-50%)', height: 150, zIndex: 9 }}
    >
      <svg width="100%" height="100%" viewBox="0 0 420 110" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <linearGradient id="vsGlow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={gold} stopOpacity="0" /><stop offset=".13" stopColor={gold} stopOpacity=".9" />
            <stop offset=".5" stopColor="#FFE9A8" /><stop offset=".87" stopColor={gold} stopOpacity=".9" /><stop offset="1" stopColor={gold} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vsCore" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".18" stopColor="#FFF6D6" /><stop offset=".5" stopColor="#fff" /><stop offset=".82" stopColor="#FFF6D6" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id="vsBlur" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="3.4" /></filter>
          <filter id="vsCoreGlow" x="-20%" y="-300%" width="140%" height="700%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <motion.g
          filter="url(#vsBlur)"
          animate={{ opacity: [0.9, 0.56, 1, 0.72, 0.9] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
        >
          {BOLTS.map((bolt, i) => (
            <motion.path key={i} d={bolt.d} fill="none" stroke="url(#vsGlow)" strokeWidth={bolt.fork ? 3 : 6.5} strokeLinecap="round" strokeLinejoin="round" {...boltAnim(i)} />
          ))}
        </motion.g>

        <motion.g
          filter="url(#vsCoreGlow)"
          animate={{ opacity: [1, 0.78, 1, 0.88, 1] }}
          transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
        >
          {BOLTS.map((bolt, i) => (
            <motion.path key={i} d={bolt.d} fill="none" stroke="url(#vsCore)" strokeWidth={bolt.fork ? 1.05 : 2.1} strokeLinecap="round" strokeLinejoin="round" {...boltAnim(i)} />
          ))}
        </motion.g>

        {SPARKS.map((s, i) => (
          <motion.circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#FFF5C8"
            initial={{ opacity: struck ? 0 : 0.9, scale: struck ? 0.4 : 1 }}
            animate={{ opacity: [0.25, 1, 0.2, 0.85, 0.25], scale: [0.8, 1.45, 0.75, 1.15, 0.8] }}
            transition={{ duration: 1.2 + i * 0.08, repeat: Infinity, ease: 'easeInOut', delay: struck ? 0.18 + i * 0.035 : i * 0.04 }}
            style={{ filter: `drop-shadow(0 0 ${Math.round(s.r * 4)}px ${gold})` }}
          />
        ))}
      </svg>

      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 168, height: 168 }}>
        <motion.div
          style={{ width: '100%', height: '100%', borderRadius: '50%', background: `radial-gradient(circle, ${gold}55, ${gold}24 38%, transparent 70%)`, filter: 'blur(8px)' }}
          animate={{ opacity: [0.55, 0.9, 0.55], scale: [0.9, 1.06, 0.9] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 82, height: 82 }}>
        <motion.div
          className="flex items-center justify-center"
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 36%, rgba(32,36,44,.96), rgba(8,10,14,.85))',
            border: `1.5px solid ${gold}b0`,
            boxShadow: `0 0 46px ${gold}80, 0 0 80px ${gold}35, 0 8px 22px rgba(0,0,0,.62), inset 0 1px 0 ${gold}70, inset 0 0 22px ${gold}40`,
          }}
          initial={{ scale: struck ? 0.5 : 1, opacity: struck ? 0 : 1 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: struck ? 0.08 : 0, type: 'spring', stiffness: 320, damping: 15 }}
        >
          <span style={{ fontWeight: 800, fontSize: 31, color: gold, textShadow: `0 0 20px ${gold}d0, 0 1px 1px rgba(0,0,0,.65)`, letterSpacing: 0 }}>VS</span>
        </motion.div>
      </div>
    </div>
  )
}
