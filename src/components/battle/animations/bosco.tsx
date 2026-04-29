'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import { curve } from './paths'
import type { AttackAnimationProps } from './types'

const C = {
  bright: '#90FF80',
  core:   '#2ECC6A',
  glow:   '#1A8A40',
  dark:   '#0D4A20',
  leaf:   '#AAFF88',
  petal:  '#F8D8E8',
  petalCore: '#E08AB8',
  vine:   '#3DA858',
}
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function BoscoAttack({ rarity, side, onComplete }: AttackAnimationProps) {
  const coords = ATTACK_COORDS[side as 'left' | 'right'] ?? ATTACK_COORDS.left
  const timing = RARITY_TIMING[rarity] ?? RARITY_TIMING.comune
  const size   = RARITY_SIZE[rarity] ?? 18
  const travelS  = timing.travel / 1000
  const impactD  = (timing.total - timing.travel) / 1000
  const impactDelay = timing.travel / 1000
  const impactR  = size * 4.5
  const path = curve(coords, rarity === 'mitologico' ? 12 : 8, side === 'left' ? 4 : -4)

  useEffect(() => {
    if (!onComplete) return
    const t = setTimeout(onComplete, timing.total + 100)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pieces ───────────────────────────────────────────────────────────────────

  /** Spinning leaf projectile. */
  function Leaf({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const w = size * 1.4 * scale
    const h = size * 0.78 * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: w, height: h,
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          background: `radial-gradient(ellipse at 40% 40%, ${C.bright} 0%, ${C.core} 55%, ${C.glow} 90%)`,
          boxShadow: `0 0 ${w * 0.5}px ${C.core}CC, 0 0 ${w}px ${C.core}44`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3, rotate: 0 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 1, 1, 0.9, 0],
          scale: [0.3, 1, 1.05, 0.9, 0.4],
          rotate: [0, 720],
        }}
        transition={{ duration: travelS, delay, ease: EASE, times: [0, 0.12, 0.55, 0.85, 1] }}
      />
    )
  }

  /** Trail of small spinning leaf bits. */
  function LeafBit({ delay = 0, frac = 0.42 }: { delay?: number; frac?: number }) {
    const w = size * frac * 1.3
    const h = size * frac * 0.7
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: w, height: h,
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          background: C.core,
          boxShadow: `0 0 5px ${C.glow}`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3, rotate: 0 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 0.9, 0.6, 0],
          scale: [0.3, 0.85, 0.4, 0.1],
          rotate: [0, 540],
        }}
        transition={{ duration: travelS * 0.85, delay, ease: EASE }}
      />
    )
  }

  function ImpactBurst({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright}FF 0%, ${C.core}CC 28%, ${C.glow}55 56%, transparent 76%)`,
          boxShadow: `0 0 ${r * 0.35}px ${C.core}99`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.65, 0], opacity: [0, 0.95, 0] }}
        transition={{ duration: impactD, delay: impactDelay + delay, ease: [0, 0.5, 1, 1] }}
      />
    )
  }

  function Ring({ delay = 0, scale = 1, color = C.core, width = 2 }: { delay?: number; scale?: number; color?: string; width?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          border: `${width}px solid ${color}CC`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.4, 2.6], opacity: [0, 0.85, 0] }}
        transition={{ duration: impactD * 0.9, delay: impactDelay + delay }}
      />
    )
  }

  /** Petals scattering radially with rotation. */
  function PetalScatter({ count = 6, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2
          const dist  = impactR * 0.62
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.5, height: size * 0.32,
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                background: i % 2 === 0 ? C.leaf : C.petal,
                boxShadow: `0 0 4px ${i % 2 === 0 ? C.core : C.petalCore}`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0, rotate: 0 }}
              animate={{
                x: [0, Math.cos(angle) * dist],
                y: [0, Math.sin(angle) * dist],
                opacity: [0, 1, 0],
                scale: [0, 1.2, 0],
                rotate: [0, 270 + i * 30],
              }}
              transition={{ duration: impactD * 0.82, delay: impactDelay + delay + i * 0.013 }}
            />
          )
        })}
      </>
    )
  }

  /** Curved vines extending outward from impact (drawn as scaling rectangles). */
  function Vines({ count = 4, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 + Math.PI / count
          const len   = impactR * 0.75
          const wig   = (i % 2 ? 1 : -1) * 6
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: len, height: 3,
                background: `linear-gradient(90deg, ${C.glow}EE 0%, ${C.core}AA 60%, transparent 100%)`,
                borderRadius: '2px',
                transformOrigin: '0 50%',
                transform: `translate(-50%, -50%) rotate(${(angle * 180) / Math.PI}deg) skewY(${wig}deg)`,
                boxShadow: `0 0 4px ${C.core}`,
              }}
              initial={{ left: coords.ix, top: coords.iy, scaleX: 0, opacity: 0 }}
              animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 0.95, 0.85, 0] }}
              transition={{ duration: impactD * 0.95, delay: impactDelay + delay + i * 0.025, times: [0, 0.35, 0.7, 1] }}
            />
          )
        })}
      </>
    )
  }

  /** Tiny leaf buds at the tip of vines. */
  function VineBuds({ count = 4, delay = 0.05 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 + Math.PI / count
          const dist  = impactR * 0.7
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.32, height: size * 0.32, borderRadius: '50%',
                background: `radial-gradient(circle, ${C.bright} 0%, ${C.core} 70%)`,
                boxShadow: `0 0 5px ${C.core}`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{
                x: [0, Math.cos(angle) * dist],
                y: [0, Math.sin(angle) * dist],
                opacity: [0, 0, 1, 0],
                scale: [0, 0, 1.3, 0],
              }}
              transition={{ duration: impactD * 0.95, delay: impactDelay + delay + i * 0.025, times: [0, 0.4, 0.7, 1] }}
            />
          )
        })}
      </>
    )
  }

  /** Blooming flower at impact — multi-petal radial bloom. */
  function Bloom({ delay = 0, scale = 1, petals = 6 }: { delay?: number; scale?: number; petals?: number }) {
    const r = impactR * 0.5 * scale
    return (
      <>
        {Array.from({ length: petals }, (_, i) => {
          const angle = (i / petals) * Math.PI * 2
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: r * 0.7, height: r * 1.3,
                borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
                background: `radial-gradient(ellipse at 50% 80%, ${C.petal} 0%, ${C.bright} 60%, ${C.core} 100%)`,
                boxShadow: `0 0 6px ${C.petalCore}AA`,
                transformOrigin: '50% 90%',
                transform: `translate(-50%, -90%) rotate(${(angle * 180) / Math.PI}deg)`,
              }}
              initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.05, 1, 0], opacity: [0, 0.95, 0.9, 0] }}
              transition={{ duration: impactD * 0.95, delay: impactDelay + delay + i * 0.012, times: [0, 0.35, 0.7, 1] }}
            />
          )
        })}
        {/* Bloom center */}
        <motion.div className="absolute pointer-events-none"
          style={{
            width: r * 0.6, height: r * 0.6, borderRadius: '50%',
            background: `radial-gradient(circle, #FFF8B0 0%, ${C.petalCore} 80%)`,
            boxShadow: `0 0 8px ${C.petal}`,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 0.9, 0], opacity: [0, 1, 0.9, 0] }}
          transition={{ duration: impactD * 0.95, delay: impactDelay + delay }}
        />
      </>
    )
  }

  /** Slow falling petals — lingering effect. */
  function FallingPetals({ count = 6, delay = 0, sustainS = 0.5 }: { count?: number; delay?: number; sustainS?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const startA = -Math.PI * 0.6 + (i / count) * Math.PI * 1.2
          const dist   = impactR * (0.5 + (i % 3) * 0.15)
          const fall   = impactR * 0.55
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.42, height: size * 0.26,
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                background: i % 2 === 0 ? C.petal : C.leaf,
                boxShadow: `0 0 4px ${i % 2 === 0 ? C.petalCore : C.core}`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0, rotate: 0 }}
              animate={{
                x: [0, Math.cos(startA) * dist, Math.cos(startA) * dist + 4],
                y: [0, Math.sin(startA) * dist, Math.sin(startA) * dist + fall],
                opacity: [0, 1, 0.85, 0],
                scale: [0, 1, 1, 0.6],
                rotate: [0, 90, 240],
              }}
              transition={{ duration: sustainS, delay: impactDelay + delay + i * 0.025, times: [0, 0.25, 0.6, 1] }}
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
          background: `radial-gradient(circle, ${C.bright}AA 0%, ${C.core}55 50%, transparent 75%)`,
          boxShadow: `0 0 ${size}px ${C.core}88`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.3, 0], opacity: [0, 0.85, 0] }}
        transition={{ duration: travelS * durFrac, ease: 'easeOut' }}
      />
    )
  }

  function ScreenTint({ alpha = '14' }: { alpha?: string }) {
    return (
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: `${C.core}${alpha}` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: impactD * 0.55, delay: impactDelay }}
      />
    )
  }

  // ── Variants ─────────────────────────────────────────────────────────────────

  if (rarity === 'comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Leaf />
      <ImpactBurst />
      <Ring />
    </div>
  )

  if (rarity === 'non_comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Leaf />
      <LeafBit delay={0.05} />
      <LeafBit delay={0.11} frac={0.28} />
      <ImpactBurst />
      <Ring />
      <PetalScatter count={5} />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Leaf />
      {[0.05, 0.11, 0.17].map((d, i) => <LeafBit key={i} delay={d} frac={0.45 - i * 0.06} />)}
      <ImpactBurst />
      <Ring />
      <Vines count={4} />
      <PetalScatter count={6} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2} durFrac={0.3} />
      <Leaf scale={1.12} />
      {[0.05, 0.11, 0.18, 0.25].map((d, i) => <LeafBit key={i} delay={d} frac={0.55 - i * 0.07} />)}
      <ImpactBurst scale={1.2} />
      <Bloom petals={5} />
      <Vines count={5} />
      <VineBuds count={5} />
      <Ring delay={0.1} scale={0.8} color={C.bright} />
      <PetalScatter count={8} />
      <FallingPetals count={5} sustainS={Math.min(0.4, impactD * 0.85)} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2.6} durFrac={0.35} />
      <Leaf scale={1.35} />
      <Leaf delay={0.07} scale={0.55} />
      {[0.05, 0.11, 0.18, 0.26, 0.35].map((d, i) => <LeafBit key={i} delay={d} frac={0.62 - i * 0.07} />)}
      <ImpactBurst scale={1.5} />
      <Bloom scale={1.15} petals={6} />
      <Bloom delay={0.12} scale={0.7} petals={5} />
      <Vines count={6} />
      <VineBuds count={6} />
      <Ring scale={1.1} width={3} />
      <Ring delay={0.12} scale={0.85} color={C.bright} />
      <PetalScatter count={10} />
      <FallingPetals count={8} sustainS={Math.min(0.5, impactD * 0.78)} />
    </div>
  )

  // mitologico — multi-bloom orchard
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[0, 0.06, 0.12].map((d, i) => (
        <motion.div key={`pc-${i}`} className="absolute pointer-events-none"
          style={{ width: size * 3.2, height: size * 3.2, borderRadius: '50%', border: `2px solid ${C.core}${['CC', '88', '44'][i]}`, transform: 'translate(-50%, -50%)' }}
          initial={{ left: coords.ox, top: coords.oy, scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1.7, 0], opacity: [0, 0.8, 0], rotate: 100 }}
          transition={{ duration: travelS * 0.4, delay: d }}
        />
      ))}
      <ScreenTint alpha="18" />
      <Leaf scale={1.7} />
      <Leaf delay={0.07} scale={0.6} />
      <Leaf delay={0.14} scale={0.45} />
      {[0.05, 0.11, 0.18, 0.26, 0.35, 0.45].map((d, i) => <LeafBit key={i} delay={d} frac={0.78 - i * 0.09} />)}
      <ImpactBurst scale={1.95} />
      <Bloom scale={1.4} petals={8} />
      <Bloom delay={0.1} scale={0.95} petals={6} />
      <Bloom delay={0.22} scale={0.6} petals={5} />
      <Vines count={8} />
      <VineBuds count={8} />
      <Ring scale={1.2} width={3} />
      <Ring delay={0.12} scale={1.5} color={C.bright} />
      <Ring delay={0.24} scale={1.8} />
      <PetalScatter count={14} />
      <FallingPetals count={12} sustainS={Math.min(0.7, impactD * 0.82)} />
    </div>
  )
}
