'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import { arcUp } from './paths'
import type { AttackAnimationProps } from './types'

const C = {
  bright: '#FFE070',
  core:   '#FF8020',
  glow:   '#FF5520',
  ember:  '#FF2200',
  dim:    '#A02810',
}
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function FiammaAttack({ rarity, side, onComplete }: AttackAnimationProps) {
  const coords = ATTACK_COORDS[side as 'left' | 'right'] ?? ATTACK_COORDS.left
  const timing = RARITY_TIMING[rarity] ?? RARITY_TIMING.comune
  const size   = RARITY_SIZE[rarity] ?? 18
  const travelS  = timing.travel / 1000
  const impactD  = (timing.total - timing.travel) / 1000
  const impactDelay = timing.travel / 1000
  const impactR  = size * 4.5
  const path = arcUp(coords, rarity === 'mitologico' ? 18 : rarity === 'leggendario' ? 16 : 12)

  useEffect(() => {
    if (!onComplete) return
    const t = setTimeout(onComplete, timing.total + 100)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pieces ───────────────────────────────────────────────────────────────────

  function Fireball({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const s = size * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${C.bright} 0%, ${C.core} 38%, ${C.ember} 78%, transparent 100%)`,
          boxShadow: `0 0 ${s}px ${C.glow}DD, 0 0 ${s * 2}px ${C.glow}55`,
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

  /** Vertical flame wisp (rises slightly via y offset — anti-gravity feel). */
  function FlameTail({ delay = 0, frac = 0.55 }: { delay?: number; frac?: number }) {
    const s = size * frac
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s * 1.6,
          borderRadius: '50% 50% 30% 30% / 60% 60% 40% 40%',
          background: `radial-gradient(ellipse at 50% 70%, ${C.bright} 0%, ${C.core} 50%, ${C.ember}88 85%, transparent 100%)`,
          boxShadow: `0 0 ${s * 0.6}px ${C.glow}AA`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(0.3px)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3, y: 0 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 0.85, 0.6, 0],
          scale: [0.3, 0.85, 0.55, 0.1],
          y: [0, -8],
        }}
        transition={{ duration: travelS * 0.9, delay, ease: EASE, times: [0, 0.15, 0.7, 1] }}
      />
    )
  }

  /** Asymmetric impact — flames lick UPWARD (taller than wide). */
  function ImpactInferno({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r * 0.95, height: r * 1.4,
          borderRadius: '50% 50% 30% 30% / 65% 65% 35% 35%',
          background: `radial-gradient(ellipse at 50% 75%, ${C.bright}FF 0%, ${C.core}EE 25%, ${C.glow}77 50%, transparent 75%)`,
          boxShadow: `0 0 ${r * 0.4}px ${C.glow}AA`,
          transform: 'translate(-50%, -65%)',
          filter: 'blur(0.5px)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.4, 1.6, 0], opacity: [0, 1, 0.8, 0] }}
        transition={{ duration: impactD, delay: impactDelay + delay, ease: [0, 0.5, 1, 1], times: [0, 0.25, 0.55, 1] }}
      />
    )
  }

  /** Heat-haze distortion ring at impact. */
  function HeatHaze({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const r = impactR * 1.4 * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          background: `radial-gradient(circle, transparent 50%, ${C.glow}33 65%, transparent 85%)`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(2px)',
          mixBlendMode: 'screen',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.2, 1.6], opacity: [0, 0.7, 0] }}
        transition={{ duration: impactD * 1.05, delay: impactDelay + delay }}
      />
    )
  }

  function ShockRing({ delay = 0, scale = 1, width = 3, color = C.glow }: { delay?: number; scale?: number; width?: number; color?: string }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          border: `${width}px solid ${color}DD`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.5, 2.8], opacity: [0, 0.9, 0] }}
        transition={{ duration: impactD * 0.9, delay: impactDelay + delay }}
      />
    )
  }

  function Sparks({ count = 6, delay = 0, spread = 0.6 }: { count?: number; delay?: number; spread?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 + (i % 2 ? 0.15 : 0)
          const dist  = impactR * spread * (0.85 + (i % 3) * 0.1)
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.32, height: size * 0.32, borderRadius: '50%',
                background: C.bright, boxShadow: `0 0 6px ${C.glow}`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{
                x: [0, Math.cos(angle) * dist],
                y: [0, Math.sin(angle) * dist - 6],
                opacity: [0, 1, 0],
                scale: [0, 1.2, 0],
              }}
              transition={{ duration: impactD * 0.78, delay: impactDelay + delay + i * 0.012 }}
            />
          )
        })}
      </>
    )
  }

  /** Ground fire — small flames that sway and gutter at the impact point. */
  function GroundFire({ count = 5, delay = 0, sustainS = 0.4 }: { count?: number; delay?: number; sustainS?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const offset = (i - (count - 1) / 2) * size * 0.55
          const flameH = size * (0.7 + (i % 2) * 0.25)
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.5, height: flameH,
                borderRadius: '50% 50% 30% 30% / 60% 60% 40% 40%',
                background: `radial-gradient(ellipse at 50% 80%, ${C.bright} 0%, ${C.core} 50%, ${C.ember}77 88%, transparent 100%)`,
                boxShadow: `0 0 6px ${C.glow}AA`,
                transform: 'translate(-50%, -100%)',
                filter: 'blur(0.4px)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: offset, scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1, 0.95, 1.05, 0.85, 0],
                opacity: [0, 0.95, 0.95, 0.9, 0.8, 0],
                y: [0, -2, 0, -3, 0, -4],
              }}
              transition={{ duration: sustainS, delay: impactDelay + delay + i * 0.018 }}
            />
          )
        })}
      </>
    )
  }

  function PreCharge({ scale = 2.2, durFrac = 0.35 }: { scale?: number; durFrac?: number }) {
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: size * scale, height: size * scale, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright}AA 0%, ${C.glow}55 50%, transparent 75%)`,
          boxShadow: `0 0 ${size}px ${C.ember}88`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.2, 0], opacity: [0, 0.85, 0] }}
        transition={{ duration: travelS * durFrac, ease: 'easeOut' }}
      />
    )
  }

  function Aftershock({ delay = 0.2, scale = 0.7 }: { delay?: number; scale?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright}EE 0%, ${C.core}AA 30%, transparent 70%)`,
          boxShadow: `0 0 ${r * 0.3}px ${C.glow}88`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.3, 0], opacity: [0, 0.95, 0] }}
        transition={{ duration: Math.min(impactD * 0.45, 0.32), delay: impactDelay + delay }}
      />
    )
  }

  /** Long stretched comet plume behind the projectile. */
  function MeteorTrail() {
    const len = size * 3.5
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: len, height: size * 1.2,
          borderRadius: '50%',
          background: `linear-gradient(90deg, transparent 0%, ${C.ember}55 25%, ${C.glow}AA 60%, ${C.bright}EE 95%)`,
          transform: 'translate(-90%, -50%) rotate(-32deg)',
          transformOrigin: '90% 50%',
          filter: 'blur(1.5px)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scaleX: 0.4 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 0.85, 0.85, 0],
          scaleX: [0.4, 1, 1, 0.5],
        }}
        transition={{ duration: travelS, ease: EASE, times: [0, 0.15, 0.85, 1] }}
      />
    )
  }

  function ScreenHeat({ alpha = '18' }: { alpha?: string }) {
    return (
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: `${C.glow}${alpha}` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: impactD * 0.55, delay: impactDelay }}
      />
    )
  }

  // ── Variants ─────────────────────────────────────────────────────────────────

  if (rarity === 'comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <FlameTail frac={0.5} />
      <Fireball />
      <ImpactInferno />
      <ShockRing />
    </div>
  )

  if (rarity === 'non_comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <FlameTail frac={0.55} />
      <FlameTail delay={0.04} frac={0.4} />
      <Fireball />
      <ImpactInferno />
      <ShockRing />
      <Sparks count={5} />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <FlameTail frac={0.6} />
      <FlameTail delay={0.05} frac={0.45} />
      <FlameTail delay={0.1} frac={0.32} />
      <Fireball />
      {/* Twin micro-fireballs that converge toward the same impact */}
      <Fireball delay={0.06} scale={0.55} />
      <Fireball delay={0.12} scale={0.4} />
      <ImpactInferno />
      <HeatHaze />
      <ShockRing />
      <Sparks count={7} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2} durFrac={0.3} />
      <FlameTail frac={0.7} />
      <FlameTail delay={0.05} frac={0.55} />
      <FlameTail delay={0.1} frac={0.4} />
      <Fireball scale={1.1} />
      <ImpactInferno scale={1.2} />
      <HeatHaze scale={1.15} />
      <ShockRing />
      <ShockRing delay={0.1} scale={0.7} width={2} color={C.bright} />
      <Sparks count={9} />
      <GroundFire count={4} sustainS={Math.min(0.36, impactD * 0.8)} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2.6} durFrac={0.35} />
      <MeteorTrail />
      <FlameTail frac={0.75} />
      <FlameTail delay={0.05} frac={0.6} />
      <FlameTail delay={0.1} frac={0.45} />
      <FlameTail delay={0.15} frac={0.32} />
      <Fireball scale={1.3} />
      <Fireball delay={0.08} scale={0.45} />
      <ImpactInferno scale={1.5} />
      <HeatHaze scale={1.4} />
      <ShockRing scale={1.1} width={4} />
      <ShockRing delay={0.1} scale={0.85} width={2} color={C.bright} />
      <Aftershock delay={0.18} scale={0.85} />
      <Aftershock delay={0.32} scale={0.6} />
      <Sparks count={11} spread={0.7} />
      <GroundFire count={6} sustainS={Math.min(0.45, impactD * 0.78)} />
    </div>
  )

  // mitologico — meteor swarm + lingering inferno
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Triple ring vortex pre-charge */}
      {[0, 0.06, 0.12].map((d, i) => (
        <motion.div key={`pc-${i}`} className="absolute pointer-events-none"
          style={{ width: size * 3.2, height: size * 3.2, borderRadius: '50%', border: `2px solid ${C.glow}${['CC', '88', '44'][i]}`, transform: 'translate(-50%, -50%)' }}
          initial={{ left: coords.ox, top: coords.oy, scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1.7, 0], opacity: [0, 0.8, 0], rotate: 120 }}
          transition={{ duration: travelS * 0.4, delay: d }}
        />
      ))}
      <ScreenHeat alpha="22" />
      <MeteorTrail />
      {[0, 0.05, 0.1, 0.15, 0.2, 0.26].map((d, i) => <FlameTail key={`tt-${i}`} delay={d} frac={0.85 - i * 0.09} />)}
      <Fireball scale={1.65} />
      {/* Satellite meteors converging */}
      <Fireball delay={0.06} scale={0.55} />
      <Fireball delay={0.13} scale={0.42} />
      <Fireball delay={0.2} scale={0.32} />
      <ImpactInferno scale={1.9} />
      <ImpactInferno scale={1.2} delay={0.1} />
      <HeatHaze scale={1.7} />
      <HeatHaze scale={2.1} delay={0.15} />
      <ShockRing scale={1.2} width={4} color={C.bright} />
      <ShockRing delay={0.1} scale={1.5} width={3} color={C.glow} />
      <ShockRing delay={0.22} scale={1.8} width={2} color={C.ember} />
      <Aftershock delay={0.2} scale={1.0} />
      <Aftershock delay={0.4} scale={0.75} />
      <Aftershock delay={0.55} scale={0.55} />
      <Sparks count={16} spread={0.75} />
      <GroundFire count={8} sustainS={Math.min(0.62, impactD * 0.82)} />
    </div>
  )
}
