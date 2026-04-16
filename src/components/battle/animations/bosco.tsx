'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import type { AttackAnimationProps } from './types'

const C = { bright: '#90FF80', core: '#2ECC6A', glow: '#1A8A40', dark: '#0D4A20', leaf: '#AAFF88' }
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function BoscoAttack({ rarity, side, onComplete }: AttackAnimationProps) {
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

  // ── Leaf shape (an oval, slightly rotated) ─────────────────────────────────
  function Leaf({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const w = size * 1.35 * scale
    const h = size * 0.75 * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: w, height: h,
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          background: `radial-gradient(ellipse, ${C.bright} 0%, ${C.core} 55%, ${C.glow} 90%)`,
          boxShadow: `0 0 ${w * 0.6}px ${C.core}CC, 0 0 ${w * 1.2}px ${C.core}44`,
          transform: 'translate(-50%, -50%) rotate(30deg)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.35, rotate: 30 }}
        animate={{
          left: [coords.ox, coords.ix], top: [coords.oy, coords.iy],
          opacity: [0, 1, 1, 0], scale: [0.35, 1, 0.9, 0.4], rotate: [30, 390],
        }}
        transition={{ duration: travelS, delay, ease: EASE, times: [0, 0.1, 0.82, 1] }}
      />
    )
  }

  function LeafBit({ delay = 0, frac = 0.42 }: { delay?: number; frac?: number }) {
    const w = size * frac * 1.3
    const h = size * frac * 0.7
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: w, height: h,
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          background: C.core, boxShadow: `0 0 5px ${C.glow}`,
          transform: 'translate(-50%, -50%) rotate(20deg)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3 }}
        animate={{
          left: [coords.ox, coords.ix], top: [coords.oy, coords.iy],
          opacity: [0, 0.85, 0.6, 0], scale: [0.3, 0.8, 0.4, 0.1],
        }}
        transition={{ duration: travelS * 0.84, delay, ease: EASE }}
      />
    )
  }

  function ImpactBurst({ scale = 1 }: { scale?: number }) {
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
        animate={{ scale: [0, 1.65, 0], opacity: [0, 0.9, 0] }}
        transition={{ duration: impactD, delay: impactDelay, ease: [0, 0.5, 1, 1] }}
      />
    )
  }

  function Ring({ delay = 0, scale = 1, color = C.core }: { delay?: number; scale?: number; color?: string }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          border: `2px solid ${color}CC`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.4, 2.6], opacity: [0, 0.8, 0] }}
        transition={{ duration: impactD * 0.88, delay: impactDelay + delay }}
      />
    )
  }

  function LeafScatter({ count = 6, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2
          const dist  = impactR * 0.58
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.42, height: size * 0.25,
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                background: C.leaf, boxShadow: `0 0 4px ${C.core}`,
                transform: 'translate(-50%, -50%) rotate(0deg)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0, rotate: 0 }}
              animate={{
                x: [0, Math.cos(angle) * dist], y: [0, Math.sin(angle) * dist],
                opacity: [0, 1, 0], scale: [0, 1.2, 0], rotate: [0, 180 + i * 25],
              }}
              transition={{ duration: impactD * 0.8, delay: impactDelay + delay + i * 0.013 }}
            />
          )
        })}
      </>
    )
  }

  // ── Root lines (short stubs radiating from impact) ─────────────────────────
  function Roots({ count = 4, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2
          const len   = impactR * 0.5
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: len, height: 3,
                background: `linear-gradient(90deg, ${C.glow}, transparent)`,
                transformOrigin: '0 50%',
                transform: `translate(-50%, -50%) rotate(${(angle * 180) / Math.PI}deg)`,
              }}
              initial={{ left: coords.ix, top: coords.iy, scaleX: 0, opacity: 0 }}
              animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 0.9, 0.9, 0] }}
              transition={{ duration: impactD * 0.9, delay: impactDelay + delay + i * 0.02 }}
            />
          )
        })}
      </>
    )
  }

  // ── Rarity variants ────────────────────────────────────────────────────────

  if (rarity === 'comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Leaf />
      <ImpactBurst />
    </div>
  )

  if (rarity === 'non_comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Leaf />
      <LeafBit delay={0.05} />
      <LeafBit delay={0.11} frac={0.28} />
      <ImpactBurst />
      <Ring />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Leaf />
      {[0.05, 0.11, 0.17].map((d, i) => <LeafBit key={i} delay={d} frac={0.44 - i * 0.06} />)}
      <ImpactBurst />
      <Ring />
      <LeafScatter count={6} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Leaf scale={1.12} />
      {[0.05, 0.11, 0.18, 0.25].map((d, i) => <LeafBit key={i} delay={d} frac={0.54 - i * 0.07} />)}
      <ImpactBurst scale={1.22} />
      <Ring />
      <Ring delay={0.14} scale={0.75} color={C.bright} />
      <LeafScatter count={8} />
      <Roots count={4} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Pre-charge — nature energy rises at origin */}
      <motion.div className="absolute pointer-events-none"
        style={{ width: size * 2.2, height: size * 2.2, borderRadius: '50%', background: `radial-gradient(circle, ${C.bright}88 0%, ${C.core}44 50%, transparent 75%)`, transform: 'translate(-50%, -50%)' }}
        initial={{ left: coords.ox, top: coords.oy, scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 2.1, 0], opacity: [0, 0.72, 0] }}
        transition={{ duration: travelS * 0.35 }}
      />
      <Leaf scale={1.35} />
      {[0.05, 0.11, 0.18, 0.26, 0.35].map((d, i) => <LeafBit key={i} delay={d} frac={0.62 - i * 0.07} />)}
      <ImpactBurst scale={1.55} />
      <Ring scale={1.1} />
      <Ring delay={0.12} scale={0.8} color={C.bright} />
      <LeafScatter count={10} />
      <Roots count={6} />
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
      <Leaf scale={1.7} />
      {[0.05, 0.11, 0.18, 0.26, 0.35, 0.45].map((d, i) => <LeafBit key={i} delay={d} frac={0.78 - i * 0.09} />)}
      <ImpactBurst scale={2.1} />
      <Ring />
      <Ring delay={0.1} scale={0.82} color={C.bright} />
      <Ring delay={0.22} scale={0.6} />
      <LeafScatter count={14} />
      <Roots count={8} />
    </div>
  )
}
