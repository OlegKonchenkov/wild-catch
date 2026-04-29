'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import { spiral } from './paths'
import type { AttackAnimationProps } from './types'

const C = {
  bright: '#E8C0FF',
  core:   '#B060F8',
  glow:   '#8030D0',
  deep:   '#5010A0',
  spark:  '#F0D8FF',
  prismA: '#FF6BD8',
  prismB: '#5BE0FF',
  prismC: '#FFE070',
}
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function ArmoniaAttack({ rarity, side, onComplete }: AttackAnimationProps) {
  const coords = ATTACK_COORDS[side as 'left' | 'right'] ?? ATTACK_COORDS.left
  const timing = RARITY_TIMING[rarity] ?? RARITY_TIMING.comune
  const size   = RARITY_SIZE[rarity] ?? 18
  const travelS  = timing.travel / 1000
  const impactD  = (timing.total - timing.travel) / 1000
  const impactDelay = timing.travel / 1000
  const impactR  = size * 4.5
  const path = spiral(coords, rarity === 'mitologico' ? 8 : rarity === 'leggendario' ? 7 : 5)

  useEffect(() => {
    if (!onComplete) return
    const t = setTimeout(onComplete, timing.total + 100)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pieces ───────────────────────────────────────────────────────────────────

  function Orb({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const s = size * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${C.spark} 0%, ${C.bright} 25%, ${C.core} 60%, ${C.deep} 90%, transparent 100%)`,
          boxShadow: `0 0 ${s}px ${C.core}DD, 0 0 ${s * 2}px ${C.glow}66, 0 0 ${s * 3.5}px ${C.glow}22`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.35 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 1, 1, 0.9, 0],
          scale: [0.35, 1, 1.05, 0.9, 0.4],
        }}
        transition={{ duration: travelS, delay, ease: EASE, times: [0, 0.12, 0.55, 0.85, 1] }}
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
          boxShadow: `0 0 6px ${C.core}, 0 0 12px ${C.glow}66`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 0.9, 0.6, 0],
          scale: [0.3, 0.85, 0.45, 0.1],
        }}
        transition={{ duration: travelS * 0.86, delay, ease: EASE }}
      />
    )
  }

  /** Particles in orbital motion around the projectile core. */
  function OrbitParticles({ count = 4, radius = 0.7, color = C.bright }: { count?: number; radius?: number; color?: string }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const phase = (i / count) * Math.PI * 2
          const orbitR = size * radius
          // Compute a few orbit positions during travel
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.28, height: size * 0.28, borderRadius: '50%',
                background: color, boxShadow: `0 0 5px ${C.core}`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ox, top: coords.oy, opacity: 0, x: 0, y: 0 }}
              animate={{
                left: path.left, top: path.top,
                opacity: [0, 0.95, 0.85, 0],
                x: [Math.cos(phase) * orbitR, Math.cos(phase + Math.PI * 4) * orbitR],
                y: [Math.sin(phase) * orbitR, Math.sin(phase + Math.PI * 4) * orbitR],
              }}
              transition={{ duration: travelS, ease: EASE, times: [0, 0.12, 0.85, 1] }}
            />
          )
        })}
      </>
    )
  }

  function ImpactBurst({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.spark}FF 0%, ${C.bright}EE 18%, ${C.core}BB 45%, ${C.glow}55 65%, transparent 80%)`,
          boxShadow: `0 0 ${r * 0.4}px ${C.core}BB, 0 0 ${r * 0.8}px ${C.glow}44`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.7, 1.2, 0], opacity: [0, 1, 0.7, 0] }}
        transition={{ duration: impactD, delay: impactDelay + delay, ease: [0, 0.5, 1, 1], times: [0, 0.2, 0.55, 1] }}
      />
    )
  }

  /** Geometric polygon ring — rotates as it expands. */
  function GeomRing({ delay = 0, scale = 1, sides = 6, color = C.core }: { delay?: number; scale?: number; sides?: number; color?: string }) {
    const r = impactR * scale
    const pts = Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2
      return `${50 + 50 * Math.cos(a)}% ${50 + 50 * Math.sin(a)}%`
    }).join(', ')
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r,
          border: `2px solid ${color}DD`,
          clipPath: `polygon(${pts})`,
          transform: 'translate(-50%, -50%)',
          boxShadow: `0 0 8px ${color}66`,
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0, rotate: 0 }}
        animate={{ scale: [0.1, 1.5, 2.6], opacity: [0, 0.9, 0], rotate: [0, 90] }}
        transition={{ duration: impactD * 0.9, delay: impactDelay + delay }}
      />
    )
  }

  function Ring({ delay = 0, scale = 1, color = C.core, width = 2 }: { delay?: number; scale?: number; color?: string; width?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          border: `${width}px solid ${color}BB`,
          transform: 'translate(-50%, -50%)',
          boxShadow: `0 0 6px ${color}55`,
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.4, 2.5], opacity: [0, 0.85, 0] }}
        transition={{ duration: impactD * 0.9, delay: impactDelay + delay }}
      />
    )
  }

  /** Implosion ring — contracts inward then bursts. */
  function VoidPulse({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          border: `3px solid ${C.glow}AA`,
          transform: 'translate(-50%, -50%)',
          boxShadow: `0 0 8px ${C.deep}`,
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 2.5, opacity: 0 }}
        animate={{ scale: [2.5, 0.8, 0], opacity: [0, 0.85, 0] }}
        transition={{ duration: impactD * 0.7, delay: impactDelay + delay }}
      />
    )
  }

  function Sparks({ count = 6, delay = 0, spread = 0.6 }: { count?: number; delay?: number; spread?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2
          const dist  = impactR * spread
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.32, height: size * 0.32, borderRadius: '50%',
                background: C.spark, boxShadow: `0 0 6px ${C.core}, 0 0 12px ${C.glow}55`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{
                x: [0, Math.cos(angle) * dist],
                y: [0, Math.sin(angle) * dist],
                opacity: [0, 1, 0],
                scale: [0, 1.25, 0],
              }}
              transition={{ duration: impactD * 0.78, delay: impactDelay + delay + i * 0.013 }}
            />
          )
        })}
      </>
    )
  }

  /** Prismatic light beam — radial slash from impact. */
  function PrismBeam({ angle = 0, delay = 0, length = 1.2, color = C.spark }: { angle?: number; delay?: number; length?: number; color?: string }) {
    const len = impactR * length
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: len, height: 3,
          background: `linear-gradient(90deg, ${color}EE 0%, ${color}88 40%, transparent 100%)`,
          transformOrigin: '0 50%',
          transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          boxShadow: `0 0 8px ${color}AA`,
          filter: 'blur(0.5px)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1.2, 0], opacity: [0, 1, 0] }}
        transition={{ duration: impactD * 0.85, delay: impactDelay + delay }}
      />
    )
  }

  /** Multi-color prism star — beams in all directions. */
  function PrismStar({ count = 6, delay = 0, length = 1.3 }: { count?: number; delay?: number; length?: number }) {
    const palette = [C.prismA, C.prismB, C.prismC, C.spark, C.bright, C.core]
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * 360
          const color = palette[i % palette.length]
          return <PrismBeam key={i} angle={angle} delay={delay + i * 0.01} length={length * (0.85 + (i % 3) * 0.1)} color={color} />
        })}
      </>
    )
  }

  /** Lingering geometric sigil that fades after impact. */
  function Sigil({ delay = 0, scale = 1, sides = 6, color = C.bright, sustainS = 0.4 }: { delay?: number; scale?: number; sides?: number; color?: string; sustainS?: number }) {
    const r = impactR * scale
    const pts = Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2
      return `${50 + 50 * Math.cos(a)}% ${50 + 50 * Math.sin(a)}%`
    }).join(', ')
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r,
          border: `2px solid ${color}AA`,
          clipPath: `polygon(${pts})`,
          transform: 'translate(-50%, -50%)',
          boxShadow: `0 0 12px ${color}66`,
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.3, opacity: 0, rotate: 0 }}
        animate={{ scale: [0.3, 1, 1.05, 0], opacity: [0, 0.9, 0.85, 0], rotate: [0, 360] }}
        transition={{ duration: sustainS, delay: impactDelay + delay, times: [0, 0.25, 0.7, 1] }}
      />
    )
  }

  /** Pre-charge glow at origin. */
  function PreCharge({ scale = 2.2, durFrac = 0.35 }: { scale?: number; durFrac?: number }) {
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: size * scale, height: size * scale, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.spark}AA 0%, ${C.core}55 50%, ${C.glow}33 75%, transparent 90%)`,
          boxShadow: `0 0 ${size}px ${C.core}88`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.3, 0], opacity: [0, 0.9, 0] }}
        transition={{ duration: travelS * durFrac, ease: 'easeOut' }}
      />
    )
  }

  function ScreenTint({ alpha = '14', color = C.core }: { alpha?: string; color?: string }) {
    return (
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: `${color}${alpha}` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: impactD * 0.6, delay: impactDelay }}
      />
    )
  }

  // ── Variants ─────────────────────────────────────────────────────────────────

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
      <Sparks count={5} />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <OrbitParticles count={3} radius={0.65} />
      <Orb />
      {[0.05, 0.11, 0.17].map((d, i) => <Sparkle key={i} delay={d} frac={0.45 - i * 0.07} />)}
      <ImpactBurst />
      <GeomRing sides={6} />
      <Ring delay={0.12} scale={0.75} />
      <Sparks count={6} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2} durFrac={0.3} />
      <OrbitParticles count={4} radius={0.7} />
      <Orb scale={1.12} />
      {[0.05, 0.11, 0.18, 0.26].map((d, i) => <Sparkle key={i} delay={d} frac={0.55 - i * 0.07} />)}
      <ImpactBurst scale={1.22} />
      <PrismStar count={4} length={1.0} />
      <GeomRing sides={8} />
      <Ring delay={0.12} scale={0.82} color={C.bright} />
      <VoidPulse scale={0.9} />
      <Sparks count={8} />
      <Sigil delay={0.05} scale={0.85} sides={6} sustainS={Math.min(0.4, impactD * 0.85)} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2.6} durFrac={0.35} />
      <OrbitParticles count={5} radius={0.75} />
      <OrbitParticles count={3} radius={1.0} color={C.prismA} />
      <Orb scale={1.35} />
      {[0.05, 0.11, 0.18, 0.26, 0.35].map((d, i) => <Sparkle key={i} delay={d} frac={0.62 - i * 0.07} />)}
      <ImpactBurst scale={1.55} />
      <PrismStar count={6} length={1.3} />
      <GeomRing sides={8} />
      <GeomRing delay={0.1} scale={0.8} sides={6} color={C.bright} />
      <Ring delay={0.2} scale={1.1} />
      <VoidPulse scale={1.1} />
      <Sparks count={11} spread={0.7} />
      <Sigil delay={0.08} scale={1.0} sides={6} color={C.bright} sustainS={Math.min(0.5, impactD * 0.78)} />
      <Sigil delay={0.18} scale={0.65} sides={8} color={C.prismB} sustainS={Math.min(0.45, impactD * 0.7)} />
    </div>
  )

  // mitologico — dimensional rift
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[0, 0.06, 0.12].map((d, i) => (
        <motion.div key={`pc-${i}`} className="absolute pointer-events-none"
          style={{ width: size * 3.2, height: size * 3.2, borderRadius: '50%', border: `2px solid ${C.core}${['CC', '88', '44'][i]}`, transform: 'translate(-50%, -50%)' }}
          initial={{ left: coords.ox, top: coords.oy, scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1.7, 0], opacity: [0, 0.8, 0], rotate: 180 }}
          transition={{ duration: travelS * 0.4, delay: d }}
        />
      ))}
      <ScreenTint alpha="22" />
      <OrbitParticles count={6} radius={0.85} />
      <OrbitParticles count={4} radius={1.15} color={C.prismA} />
      <OrbitParticles count={3} radius={1.4} color={C.prismB} />
      <Orb scale={1.7} />
      {[0.05, 0.11, 0.18, 0.26, 0.35, 0.45].map((d, i) => <Sparkle key={i} delay={d} frac={0.78 - i * 0.09} />)}
      <ImpactBurst scale={2.1} />
      <ImpactBurst scale={1.3} delay={0.12} />
      <PrismStar count={8} length={1.55} />
      <PrismStar count={6} length={1.0} delay={0.1} />
      <GeomRing sides={8} scale={1.2} />
      <GeomRing delay={0.08} scale={0.85} sides={6} color={C.bright} />
      <Ring delay={0.18} scale={1.45} />
      <Ring delay={0.3} scale={1.8} color={C.prismB} />
      <VoidPulse scale={1.3} />
      <VoidPulse delay={0.15} scale={0.85} />
      <Sparks count={16} spread={0.78} />
      {/* Lingering rotating sigil stack */}
      <Sigil delay={0.08} scale={1.25} sides={8} color={C.bright} sustainS={Math.min(0.7, impactD * 0.85)} />
      <Sigil delay={0.18} scale={0.85} sides={6} color={C.prismA} sustainS={Math.min(0.6, impactD * 0.78)} />
      <Sigil delay={0.28} scale={0.55} sides={4} color={C.prismB} sustainS={Math.min(0.5, impactD * 0.7)} />
    </div>
  )
}
