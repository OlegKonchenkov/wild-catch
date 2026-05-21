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

const BOLTS: Array<{ d: string; kind: 'main' | 'branch' | 'hair' }> = [
  { kind: 'main', d: 'M226 62 L207 58 L190 65 L170 57 L151 62 L130 54 L111 59 L90 50 L73 57 L53 52 L34 59 L16 56 L0 61' },
  { kind: 'main', d: 'M294 62 L313 58 L330 65 L350 57 L369 62 L390 54 L409 59 L430 50 L447 57 L467 52 L486 59 L504 56 L520 61' },
  { kind: 'branch', d: 'M202 59 L186 50 L169 52 L151 45 L132 49 L112 42 L92 47 L73 40 L53 46 L34 42 L12 48' },
  { kind: 'branch', d: 'M318 59 L334 50 L351 52 L369 45 L388 49 L408 42 L428 47 L447 40 L467 46 L486 42 L508 48' },
  { kind: 'branch', d: 'M188 64 L171 73 L151 69 L130 78 L110 72 L89 82 L67 76 L45 84 L23 80' },
  { kind: 'branch', d: 'M332 64 L349 73 L369 69 L390 78 L410 72 L431 82 L453 76 L475 84 L497 80' },
  { kind: 'hair', d: 'M116 58 L101 79 L84 75 L72 91' },
  { kind: 'hair', d: 'M170 57 L156 81 L139 76' },
  { kind: 'hair', d: 'M74 57 L58 38 L42 42' },
  { kind: 'hair', d: 'M404 58 L419 79 L436 75 L448 91' },
  { kind: 'hair', d: 'M350 57 L364 81 L381 76' },
  { kind: 'hair', d: 'M446 57 L462 38 L478 42' },
]

const SPARKS = [
  { cx: 226, cy: 62, r: 2.4 },
  { cx: 294, cy: 62, r: 2.4 },
  { cx: 151, cy: 62, r: 1.1 },
  { cx: 369, cy: 62, r: 1.1 },
  { cx: 74, cy: 57, r: 0.9 },
  { cx: 446, cy: 57, r: 0.9 },
]

export default function VsEmblem({ struck = true, gold = '#F7C841', topPct = 50 }: Props) {
  const widthFor = (kind: 'main' | 'branch' | 'hair', layer: 'aura' | 'amber' | 'core') => {
    if (layer === 'aura') return kind === 'main' ? 9 : kind === 'branch' ? 4.2 : 2
    if (layer === 'amber') return kind === 'main' ? 2.7 : kind === 'branch' ? 1.25 : 0.75
    return kind === 'main' ? 1.05 : kind === 'branch' ? 0.48 : 0.32
  }
  const opacityFor = (kind: 'main' | 'branch' | 'hair', layer: 'aura' | 'amber' | 'core') => {
    if (layer === 'aura') return kind === 'main' ? 1 : kind === 'branch' ? 0.62 : 0.36
    if (layer === 'amber') return kind === 'main' ? 1 : kind === 'branch' ? 0.74 : 0.48
    return kind === 'main' ? 0.92 : kind === 'branch' ? 0.58 : 0.34
  }
  const boltAnim = (i: number) => ({
    initial: { pathLength: struck ? 0 : 1, opacity: struck ? 0 : 1 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.5, delay: struck ? 0.02 + i * 0.018 : 0, ease: 'easeOut' as const },
  })

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: 0, right: 0, top: `${topPct}%`, transform: 'translateY(-50%)', height: 138, zIndex: 9 }}
    >
      <svg width="100%" height="100%" viewBox="0 0 520 118" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <linearGradient id="vsAmber" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={gold} stopOpacity="0" />
            <stop offset=".12" stopColor="#D9821F" stopOpacity=".42" />
            <stop offset=".42" stopColor={gold} stopOpacity=".96" />
            <stop offset=".5" stopColor="#FFF0A8" stopOpacity="1" />
            <stop offset=".58" stopColor={gold} stopOpacity=".96" />
            <stop offset=".88" stopColor="#D9821F" stopOpacity=".42" />
            <stop offset="1" stopColor={gold} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vsHotCore" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".18" stopColor="#FFE2A1" stopOpacity=".7" />
            <stop offset=".5" stopColor="#FFFDF0" />
            <stop offset=".82" stopColor="#FFE2A1" stopOpacity=".7" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="vsCenterFlare" cx="50%" cy="52%" r="48%">
            <stop offset="0" stopColor="#FFF6B8" stopOpacity=".95" />
            <stop offset=".34" stopColor={gold} stopOpacity=".48" />
            <stop offset="1" stopColor={gold} stopOpacity="0" />
          </radialGradient>
          <filter id="vsWideBlur" x="-20%" y="-260%" width="140%" height="620%"><feGaussianBlur stdDeviation="4.6" /></filter>
          <filter id="vsSoftBlur" x="-20%" y="-260%" width="140%" height="620%"><feGaussianBlur stdDeviation="1.35" /></filter>
        </defs>

        <motion.ellipse
          cx="260"
          cy="62"
          rx="118"
          ry="32"
          fill="url(#vsCenterFlare)"
          filter="url(#vsWideBlur)"
          animate={{ opacity: [0.38, 0.72, 0.42], scaleX: [0.92, 1.06, 0.92] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.g
          filter="url(#vsWideBlur)"
          animate={{ opacity: [0.5, 0.88, 0.62, 0.78, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {BOLTS.map((bolt, i) => (
            <motion.path key={i} d={bolt.d} fill="none" stroke="url(#vsAmber)" strokeWidth={widthFor(bolt.kind, 'aura')} strokeLinecap="round" strokeLinejoin="round" opacity={opacityFor(bolt.kind, 'aura')} {...boltAnim(i)} />
          ))}
        </motion.g>

        <motion.g
          filter="url(#vsSoftBlur)"
          animate={{ opacity: [0.84, 0.98, 0.74, 1, 0.84] }}
          transition={{ duration: 1.65, repeat: Infinity, ease: 'easeInOut' }}
        >
          {BOLTS.map((bolt, i) => (
            <motion.path key={i} d={bolt.d} fill="none" stroke="url(#vsAmber)" strokeWidth={widthFor(bolt.kind, 'amber')} strokeLinecap="round" strokeLinejoin="round" opacity={opacityFor(bolt.kind, 'amber')} {...boltAnim(i)} />
          ))}
        </motion.g>

        <motion.g
          animate={{ opacity: [0.68, 1, 0.72, 0.94, 0.68] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
        >
          {BOLTS.map((bolt, i) => (
            <motion.path key={i} d={bolt.d} fill="none" stroke="url(#vsHotCore)" strokeWidth={widthFor(bolt.kind, 'core')} strokeLinecap="round" strokeLinejoin="round" opacity={opacityFor(bolt.kind, 'core')} {...boltAnim(i)} />
          ))}
        </motion.g>

        {SPARKS.map((s, i) => (
          <motion.circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#FFF1B8"
            initial={{ opacity: struck ? 0 : 0.7, scale: struck ? 0.4 : 1 }}
            animate={{ opacity: [0.18, 0.9, 0.25, 0.7, 0.18], scale: [0.7, 1.45, 0.8, 1.1, 0.7] }}
            transition={{ duration: 1.4 + i * 0.07, repeat: Infinity, ease: 'easeInOut', delay: struck ? 0.18 + i * 0.04 : i * 0.04 }}
            style={{ filter: `drop-shadow(0 0 ${Math.max(5, Math.round(s.r * 5))}px ${gold})` }}
          />
        ))}
      </svg>

      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 98, height: 98 }}>
        <motion.div
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, ${gold}30, transparent 70%)`, filter: 'blur(8px)' }}
          animate={{ opacity: [0.46, 0.86, 0.46], scale: [0.9, 1.08, 0.9] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <defs>
            <linearGradient id="vsRingStroke" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#FFF1AF" />
              <stop offset=".42" stopColor={gold} />
              <stop offset="1" stopColor="#B96C18" />
            </linearGradient>
            <filter id="vsRingGlow" x="-90%" y="-90%" width="280%" height="280%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx="50" cy="50" r="34" fill="rgba(7,8,10,.46)" stroke="rgba(255,214,109,.28)" strokeWidth="1" />
          <motion.circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="url(#vsRingStroke)"
            strokeWidth="2.4"
            strokeDasharray="38 10 12 18"
            strokeLinecap="round"
            filter="url(#vsRingGlow)"
            animate={{ rotate: 360, opacity: [0.72, 1, 0.76] }}
            transition={{ rotate: { duration: 8, repeat: Infinity, ease: 'linear' }, opacity: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}
            style={{ transformOrigin: '50% 50%' }}
          />
          <motion.circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={gold}
            strokeWidth="0.8"
            strokeDasharray="4 10"
            opacity=".45"
            animate={{ rotate: -360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '50% 50%' }}
          />
        </svg>
        <motion.span
          className="absolute inset-0 flex items-center justify-center"
          style={{
            fontFamily: 'Georgia, Times New Roman, serif',
            fontWeight: 700,
            fontSize: 39,
            color: '#FFE18A',
            textShadow: `0 0 10px ${gold}, 0 0 24px ${gold}b0, 0 2px 2px rgba(0,0,0,.72)`,
            letterSpacing: 0,
          }}
          initial={{ scale: struck ? 0.62 : 1, opacity: struck ? 0 : 1 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: struck ? 0.08 : 0, type: 'spring', stiffness: 300, damping: 16 }}
        >
          VS
        </motion.span>
      </div>
    </div>
  )
}
