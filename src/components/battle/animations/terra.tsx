'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import type { AttackAnimationProps } from './types'

const C = { bright: '#F0D090', core: '#D4A060', glow: '#A06830', rock: '#8B5A2B', dust: '#C8986844' }
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function TerraAttack({ rarity, side, onComplete }: AttackAnimationProps) {
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

  // ── Rock — slightly faceted (octagon via clip-path) ───────────────────────
  function Rock({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const s = size * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s,
          background: `radial-gradient(circle at 38% 35%, ${C.bright} 0%, ${C.core} 42%, ${C.rock} 80%, transparent 100%)`,
          clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)',
          boxShadow: `0 0 ${s * 0.7}px ${C.glow}CC, 0 0 ${s * 1.5}px ${C.glow}44`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.4, rotate: 0 }}
        animate={{
          left: [coords.ox, coords.ix], top: [coords.oy, coords.iy],
          opacity: [0, 1, 1, 0], scale: [0.4, 1, 0.95, 0.5], rotate: [0, 240],
        }}
        transition={{ duration: travelS, delay, ease: EASE, times: [0, 0.1, 0.82, 1] }}
      />
    )
  }

  function DustPuff({ delay = 0, frac = 0.42 }: { delay?: number; frac?: number }) {
    const s = size * frac
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright}88 0%, ${C.core}55 55%, transparent 80%)`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.4 }}
        animate={{ left: [coords.ox, coords.ix], top: [coords.oy, coords.iy], opacity: [0, 0.7, 0.4, 0], scale: [0.4, 1.2, 1.6, 0.2] }}
        transition={{ duration: travelS * 0.82, delay, ease: EASE }}
      />
    )
  }

  function ImpactCrater({ scale = 1 }: { scale?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright}FF 0%, ${C.core}BB 28%, ${C.glow}44 56%, transparent 75%)`,
          boxShadow: `0 0 ${r * 0.35}px ${C.glow}AA`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.7, 0], opacity: [0, 0.9, 0] }}
        transition={{ duration: impactD, delay: impactDelay, ease: [0, 0.5, 1, 1] }}
      />
    )
  }

  function DustCloud({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r * 1.4, height: r,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${C.bright}66 0%, ${C.core}33 50%, transparent 72%)`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.2, 2.2], opacity: [0, 0.75, 0] }}
        transition={{ duration: impactD * 0.95, delay: impactDelay + delay }}
      />
    )
  }

  function Debris({ count = 6, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2
          const dist  = impactR * 0.62
          const s = size * (0.28 + (i % 3) * 0.08)
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: s, height: s,
                background: C.core,
                clipPath: 'polygon(25% 0%, 75% 0%, 100% 30%, 80% 100%, 20% 100%, 0% 30%)',
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0, rotate: 0 }}
              animate={{
                x: [0, Math.cos(angle) * dist], y: [0, Math.sin(angle) * dist],
                opacity: [0, 1, 0], scale: [0, 1.1, 0], rotate: [0, 150 + i * 30],
              }}
              transition={{ duration: impactD * 0.78, delay: impactDelay + delay + i * 0.015 }}
            />
          )
        })}
      </>
    )
  }

  // Ground crack lines
  function Crack({ count = 4, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 + Math.PI / 8
          const len   = impactR * 0.58
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: len, height: 2,
                background: `linear-gradient(90deg, ${C.rock}, transparent)`,
                transformOrigin: '0 50%',
                transform: `translate(-50%, -50%) rotate(${(angle * 180) / Math.PI}deg)`,
              }}
              initial={{ left: coords.ix, top: coords.iy, scaleX: 0, opacity: 0 }}
              animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 0.9, 0.9, 0] }}
              transition={{ duration: impactD * 0.88, delay: impactDelay + delay + i * 0.02 }}
            />
          )
        })}
      </>
    )
  }

  // ── Rarity variants ────────────────────────────────────────────────────────

  if (rarity === 'comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Rock />
      <ImpactCrater />
      <DustCloud scale={0.85} />
    </div>
  )

  if (rarity === 'non_comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Rock />
      <DustPuff delay={0.05} />
      <DustPuff delay={0.11} frac={0.28} />
      <ImpactCrater />
      <DustCloud />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Rock />
      {[0.05, 0.11, 0.17].map((d, i) => <DustPuff key={i} delay={d} frac={0.44 - i * 0.06} />)}
      <ImpactCrater />
      <DustCloud />
      <Debris count={6} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Rock scale={1.12} />
      {[0.05, 0.11, 0.18, 0.25].map((d, i) => <DustPuff key={i} delay={d} frac={0.54 - i * 0.07} />)}
      <ImpactCrater scale={1.22} />
      <DustCloud />
      <DustCloud delay={0.14} scale={0.75} />
      <Debris count={8} />
      <Crack count={4} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Pre-charge dust cloud at origin */}
      <motion.div className="absolute pointer-events-none"
        style={{ width: size * 2.5, height: size * 2, borderRadius: '50%', background: `radial-gradient(ellipse, ${C.bright}88 0%, ${C.core}44 50%, transparent 75%)`, transform: 'translate(-50%, -50%)' }}
        initial={{ left: coords.ox, top: coords.oy, scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 2, 0], opacity: [0, 0.65, 0] }}
        transition={{ duration: travelS * 0.38 }}
      />
      <Rock scale={1.35} />
      {[0.05, 0.11, 0.18, 0.26, 0.35].map((d, i) => <DustPuff key={i} delay={d} frac={0.62 - i * 0.07} />)}
      <ImpactCrater scale={1.55} />
      <DustCloud scale={1.1} />
      <DustCloud delay={0.14} scale={0.78} />
      <Debris count={10} />
      <Crack count={6} />
    </div>
  )

  // mitologico
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[0, 0.06, 0.12].map((d, i) => (
        <motion.div key={i} className="absolute pointer-events-none"
          style={{ width: size * 3, height: size * 3, borderRadius: '50%', border: `2px solid ${C.glow}${['AA', '66', '33'][i]}`, transform: 'translate(-50%, -50%)' }}
          initial={{ left: coords.ox, top: coords.oy, scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.6, 0], opacity: [0, 0.7, 0] }}
          transition={{ duration: travelS * 0.4, delay: d }}
        />
      ))}
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: `${C.core}16` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: impactD * 0.6, delay: impactDelay }}
      />
      <Rock scale={1.7} />
      {[0.05, 0.11, 0.18, 0.26, 0.35, 0.45].map((d, i) => <DustPuff key={i} delay={d} frac={0.78 - i * 0.09} />)}
      <ImpactCrater scale={2.1} />
      <DustCloud scale={1.2} />
      <DustCloud delay={0.12} scale={0.88} />
      <DustCloud delay={0.26} scale={0.6} />
      <Debris count={14} />
      <Crack count={8} />
    </div>
  )
}
