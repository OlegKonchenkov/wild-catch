'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import type { AttackAnimationProps } from './types'

const C = { bright: '#E8C0FF', core: '#B060F8', glow: '#8030D0', deep: '#5010A0', spark: '#F0D8FF' }
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function ArmoniaAttack({ rarity, side, onComplete }: AttackAnimationProps) {
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

  function Orb({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const s = size * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright} 0%, ${C.core} 45%, ${C.deep} 80%, transparent 100%)`,
          boxShadow: `0 0 ${s}px ${C.core}DD, 0 0 ${s * 2}px ${C.glow}66, 0 0 ${s * 3.5}px ${C.glow}22`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.35 }}
        animate={{ left: [coords.ox, coords.ix], top: [coords.oy, coords.iy], opacity: [0, 1, 1, 0], scale: [0.35, 1, 0.95, 0.4] }}
        transition={{ duration: travelS, delay, ease: EASE, times: [0, 0.1, 0.82, 1] }}
      />
    )
  }

  function Sparkle({ delay = 0, frac = 0.38 }: { delay?: number; frac?: number }) {
    const s = size * frac
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: C.spark,
          boxShadow: `0 0 6px ${C.core}`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3 }}
        animate={{ left: [coords.ox, coords.ix], top: [coords.oy, coords.iy], opacity: [0, 0.9, 0.6, 0], scale: [0.3, 0.8, 0.45, 0.1] }}
        transition={{ duration: travelS * 0.83, delay, ease: EASE }}
      />
    )
  }

  function ImpactBurst({ scale = 1 }: { scale?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright}FF 0%, ${C.core}CC 28%, ${C.glow}55 55%, transparent 75%)`,
          boxShadow: `0 0 ${r * 0.4}px ${C.core}BB, 0 0 ${r * 0.8}px ${C.glow}44`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.65, 0], opacity: [0, 0.95, 0] }}
        transition={{ duration: impactD, delay: impactDelay, ease: [0, 0.5, 1, 1] }}
      />
    )
  }

  // Geometric expanding ring
  function GeomRing({ delay = 0, scale = 1, sides = 6 }: { delay?: number; scale?: number; sides?: number }) {
    const r = impactR * scale
    const pts = Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2
      return `${50 + 50 * Math.cos(a)}% ${50 + 50 * Math.sin(a)}%`
    }).join(', ')
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r,
          border: `2px solid ${C.core}CC`,
          clipPath: `polygon(${pts})`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0, rotate: 0 }}
        animate={{ scale: [0.1, 1.5, 2.6], opacity: [0, 0.85, 0], rotate: [0, 60] }}
        transition={{ duration: impactD * 0.88, delay: impactDelay + delay }}
      />
    )
  }

  // Circular ring (for multi-ring combos)
  function Ring({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          border: `2px solid ${C.core}BB`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.4, 2.5], opacity: [0, 0.8, 0] }}
        transition={{ duration: impactD * 0.88, delay: impactDelay + delay }}
      />
    )
  }

  function SparkParticles({ count = 6, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2
          const dist  = impactR * 0.58
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.35, height: size * 0.35, borderRadius: '50%',
                background: C.bright, boxShadow: `0 0 5px ${C.core}`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{ x: [0, Math.cos(angle) * dist], y: [0, Math.sin(angle) * dist], opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
              transition={{ duration: impactD * 0.78, delay: impactDelay + delay + i * 0.013 }}
            />
          )
        })}
      </>
    )
  }

  // Void implosion (rings that CONTRACT instead of expand) — for higher rarities
  function VoidPulse({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          border: `3px solid ${C.glow}99`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 2.5, opacity: 0 }}
        animate={{ scale: [2.5, 0.8, 0], opacity: [0, 0.7, 0] }}
        transition={{ duration: impactD * 0.7, delay: impactDelay + delay }}
      />
    )
  }

  // ── Rarity variants ────────────────────────────────────────────────────────

  if (rarity === 'comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Orb />
      <ImpactBurst />
      <Ring />
    </div>
  )

  if (rarity === 'non_comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Orb />
      <Sparkle delay={0.05} />
      <Sparkle delay={0.11} frac={0.26} />
      <ImpactBurst />
      <Ring />
      <SparkParticles count={5} />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Orb />
      {[0.05, 0.11, 0.17].map((d, i) => <Sparkle key={i} delay={d} frac={0.44 - i * 0.06} />)}
      <ImpactBurst />
      <GeomRing sides={6} />
      <Ring delay={0.12} scale={0.75} />
      <SparkParticles count={6} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Orb scale={1.12} />
      {[0.05, 0.11, 0.18, 0.26].map((d, i) => <Sparkle key={i} delay={d} frac={0.54 - i * 0.07} />)}
      <ImpactBurst scale={1.22} />
      <GeomRing sides={8} />
      <Ring delay={0.12} scale={0.82} />
      <VoidPulse scale={0.9} />
      <SparkParticles count={8} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Pre-charge glow */}
      <motion.div className="absolute pointer-events-none"
        style={{ width: size * 2.2, height: size * 2.2, borderRadius: '50%', background: `radial-gradient(circle, ${C.bright}88 0%, ${C.core}44 50%, transparent 75%)`, transform: 'translate(-50%, -50%)' }}
        initial={{ left: coords.ox, top: coords.oy, scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 2.1, 0], opacity: [0, 0.72, 0] }}
        transition={{ duration: travelS * 0.35 }}
      />
      {/* Orbiting particles on projectile */}
      {[0, 0.5, 1, 1.5].map((offset, i) => {
        const orbitAngle = (offset / 2) * Math.PI * 2
        const orbitR = size * 0.7
        return (
          <motion.div key={i} className="absolute pointer-events-none"
            style={{
              width: size * 0.28, height: size * 0.28, borderRadius: '50%',
              background: C.bright, boxShadow: `0 0 4px ${C.core}`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ left: coords.ox, top: coords.oy, opacity: 0 }}
            animate={{
              left: [coords.ox, coords.ix],
              top: [coords.oy, coords.iy],
              x: [Math.cos(orbitAngle) * orbitR, Math.cos(orbitAngle + 4) * orbitR],
              y: [Math.sin(orbitAngle) * orbitR, Math.sin(orbitAngle + 4) * orbitR],
              opacity: [0, 0.9, 0.7, 0],
            }}
            transition={{ duration: travelS, ease: EASE, times: [0, 0.1, 0.82, 1] }}
          />
        )
      })}
      <Orb scale={1.35} />
      {[0.05, 0.11, 0.18, 0.26, 0.35].map((d, i) => <Sparkle key={i} delay={d} frac={0.62 - i * 0.07} />)}
      <ImpactBurst scale={1.55} />
      <GeomRing sides={8} />
      <GeomRing delay={0.1} scale={0.8} sides={6} />
      <Ring delay={0.2} scale={1.1} />
      <VoidPulse scale={1.1} />
      <SparkParticles count={10} />
    </div>
  )

  // mitologico — dimensional rift
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Pre-charge — space distortion at origin */}
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
        style={{ background: `${C.core}18` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: impactD * 0.65, delay: impactDelay }}
      />
      {/* Orbiting particles */}
      {[0, 0.33, 0.67, 1.0, 1.33, 1.67].map((offset, i) => {
        const orbitAngle = (offset / 2) * Math.PI * 2
        const orbitR = size * 0.85
        return (
          <motion.div key={i} className="absolute pointer-events-none"
            style={{
              width: size * 0.3, height: size * 0.3, borderRadius: '50%',
              background: C.bright, boxShadow: `0 0 5px ${C.core}`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ left: coords.ox, top: coords.oy, opacity: 0 }}
            animate={{
              left: [coords.ox, coords.ix],
              top: [coords.oy, coords.iy],
              x: [Math.cos(orbitAngle) * orbitR, Math.cos(orbitAngle + 5) * orbitR],
              y: [Math.sin(orbitAngle) * orbitR, Math.sin(orbitAngle + 5) * orbitR],
              opacity: [0, 0.95, 0.7, 0],
            }}
            transition={{ duration: travelS, ease: EASE, times: [0, 0.1, 0.82, 1] }}
          />
        )
      })}
      <Orb scale={1.7} />
      {[0.05, 0.11, 0.18, 0.26, 0.35, 0.45].map((d, i) => <Sparkle key={i} delay={d} frac={0.78 - i * 0.09} />)}
      <ImpactBurst scale={2.1} />
      <GeomRing sides={8} />
      <GeomRing delay={0.08} scale={0.85} sides={6} />
      <Ring delay={0.18} scale={1.15} />
      <Ring delay={0.3} scale={0.7} />
      <VoidPulse scale={1.2} />
      <VoidPulse delay={0.15} scale={0.7} />
      <SparkParticles count={14} />
    </div>
  )
}
