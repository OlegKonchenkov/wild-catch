'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import type { AttackAnimationProps } from './types'

const C = { bright: '#AAEEFF', core: '#00C4E8', glow: '#0088CC', deep: '#005599', drop: '#66DDFF' }
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function AdriaticoAttack({ rarity, side, onComplete }: AttackAnimationProps) {
  const coords = ATTACK_COORDS[side as 'left' | 'right'] ?? ATTACK_COORDS.left
  const timing = RARITY_TIMING[rarity] ?? RARITY_TIMING.comune
  const size   = RARITY_SIZE[rarity] ?? 18
  const travelS  = timing.travel / 1000
  const impactD  = (timing.total - timing.travel) / 1000
  const impactDelay = timing.travel / 1000
  const impactR  = size * 4.5

  useEffect(() => {
    if (!onComplete) return
    const t = setTimeout(onComplete, timing.total + 100)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reusable pieces ────────────────────────────────────────────────────────

  function Bubble({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const s = size * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright} 0%, ${C.core} 45%, ${C.glow} 80%, transparent 100%)`,
          boxShadow: `0 0 ${s}px ${C.core}DD, 0 0 ${s * 2}px ${C.core}44`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.35 }}
        animate={{ left: [coords.ox, coords.ix], top: [coords.oy, coords.iy], opacity: [0, 1, 1, 0], scale: [0.35, 1, 0.95, 0.4] }}
        transition={{ duration: travelS, delay, ease: EASE, times: [0, 0.1, 0.82, 1] }}
      />
    )
  }

  function Droplet({ delay = 0, frac = 0.4 }: { delay?: number; frac?: number }) {
    const s = size * frac
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: C.drop, boxShadow: `0 0 5px ${C.core}`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3 }}
        animate={{ left: [coords.ox, coords.ix], top: [coords.oy, coords.iy], opacity: [0, 0.8, 0.6, 0], scale: [0.3, 0.75, 0.45, 0.1] }}
        transition={{ duration: travelS * 0.85, delay, ease: EASE }}
      />
    )
  }

  function Ripple({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          border: `2px solid ${C.core}CC`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.4, 2.6], opacity: [0, 0.85, 0] }}
        transition={{ duration: impactD * 0.9, delay: impactDelay + delay }}
      />
    )
  }

  function ImpactSplash({ scale = 1 }: { scale?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright}FF 0%, ${C.core}BB 30%, ${C.glow}44 58%, transparent 76%)`,
          boxShadow: `0 0 ${r * 0.35}px ${C.core}99`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.6, 0], opacity: [0, 0.9, 0] }}
        transition={{ duration: impactD, delay: impactDelay, ease: [0, 0.5, 1, 1] }}
      />
    )
  }

  function SplashDroplets({ count = 6, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2
          const dist  = impactR * 0.6
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.35, height: size * 0.35, borderRadius: '50%',
                background: C.bright, boxShadow: `0 0 4px ${C.core}`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{ x: [0, Math.cos(angle) * dist], y: [0, Math.sin(angle) * dist], opacity: [0, 1, 0], scale: [0, 1.1, 0] }}
              transition={{ duration: impactD * 0.78, delay: impactDelay + delay + i * 0.014 }}
            />
          )
        })}
      </>
    )
  }

  // ── Rarity variants ────────────────────────────────────────────────────────

  if (rarity === 'comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Bubble />
      <ImpactSplash />
      <Ripple />
    </div>
  )

  if (rarity === 'non_comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Bubble />
      <Droplet delay={0.04} />
      <Droplet delay={0.09} frac={0.28} />
      <ImpactSplash />
      <Ripple />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Bubble />
      {[0.04, 0.09, 0.14].map((d, i) => <Droplet key={i} delay={d} frac={0.45 - i * 0.06} />)}
      <ImpactSplash />
      <Ripple />
      <Ripple delay={0.12} scale={0.75} />
      <SplashDroplets count={6} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Bubble scale={1.12} />
      {[0.04, 0.09, 0.15, 0.22].map((d, i) => <Droplet key={i} delay={d} frac={0.55 - i * 0.06} />)}
      <ImpactSplash scale={1.25} />
      <Ripple />
      <Ripple delay={0.12} scale={0.8} />
      <Ripple delay={0.25} scale={0.55} />
      <SplashDroplets count={8} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Pre-charge glow at origin */}
      <motion.div className="absolute pointer-events-none"
        style={{ width: size * 2.2, height: size * 2.2, borderRadius: '50%', background: `radial-gradient(circle, ${C.bright}88 0%, ${C.core}44 50%, transparent 75%)`, transform: 'translate(-50%, -50%)' }}
        initial={{ left: coords.ox, top: coords.oy, scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 2, 0], opacity: [0, 0.7, 0] }}
        transition={{ duration: travelS * 0.35 }}
      />
      <Bubble scale={1.35} />
      {[0.04, 0.09, 0.15, 0.22, 0.3].map((d, i) => <Droplet key={i} delay={d} frac={0.65 - i * 0.07} />)}
      <ImpactSplash scale={1.55} />
      <Ripple />
      <Ripple delay={0.1} scale={0.85} />
      <Ripple delay={0.22} scale={0.6} />
      <SplashDroplets count={10} />
      {/* Extra whirlpool ring */}
      <motion.div className="absolute pointer-events-none"
        style={{ width: impactR * 1.4, height: impactR * 1.4, borderRadius: '50%', border: `3px solid ${C.glow}BB`, transform: 'translate(-50%, -50%)' }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0, rotate: 0 }}
        animate={{ scale: [0.1, 1.8, 2.5], opacity: [0, 0.7, 0], rotate: 360 }}
        transition={{ duration: impactD, delay: impactDelay }}
      />
    </div>
  )

  // mitologico
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Pre-charge rings */}
      {[0, 0.06, 0.12].map((d, i) => (
        <motion.div key={i} className="absolute pointer-events-none"
          style={{ width: size * 3, height: size * 3, borderRadius: '50%', border: `2px solid ${C.core}${['AA', '66', '33'][i]}`, transform: 'translate(-50%, -50%)' }}
          initial={{ left: coords.ox, top: coords.oy, scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.6, 0], opacity: [0, 0.7, 0] }}
          transition={{ duration: travelS * 0.4, delay: d }}
        />
      ))}
      {/* Screen tint */}
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: `${C.core}16` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: impactD * 0.6, delay: impactDelay }}
      />
      <Bubble scale={1.7} />
      {[0.04, 0.09, 0.15, 0.23, 0.32, 0.42].map((d, i) => <Droplet key={i} delay={d} frac={0.8 - i * 0.09} />)}
      <ImpactSplash scale={2.1} />
      <Ripple />
      <Ripple delay={0.1} scale={0.85} />
      <Ripple delay={0.22} scale={0.65} />
      <Ripple delay={0.36} scale={0.45} />
      <SplashDroplets count={14} />
    </div>
  )
}
