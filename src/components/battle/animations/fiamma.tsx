'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import type { AttackAnimationProps } from './types'

const C = { bright: '#FFD040', core: '#FF8020', glow: '#FF5520', ember: '#FF2200', dim: '#C03010' }
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function FiammaAttack({ rarity, side, onComplete }: AttackAnimationProps) {
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

  function Fireball({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const s = size * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright} 0%, ${C.core} 40%, ${C.ember} 80%, transparent 100%)`,
          boxShadow: `0 0 ${s}px ${C.glow}DD, 0 0 ${s * 2}px ${C.glow}55`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.35 }}
        animate={{ left: [coords.ox, coords.ix], top: [coords.oy, coords.iy], opacity: [0, 1, 1, 0], scale: [0.35, 1, 0.9, 0.4] }}
        transition={{ duration: travelS, delay, ease: EASE, times: [0, 0.1, 0.8, 1] }}
      />
    )
  }

  function Ember({ delay = 0, frac = 0.45 }: { delay?: number; frac?: number }) {
    const s = size * frac
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: C.glow,
          boxShadow: `0 0 6px ${C.core}`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3 }}
        animate={{ left: [coords.ox, coords.ix], top: [coords.oy, coords.iy], opacity: [0, 0.85, 0.65, 0], scale: [0.3, 0.8, 0.5, 0.1] }}
        transition={{ duration: travelS * 0.86, delay, ease: EASE }}
      />
    )
  }

  function ImpactFlash({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright}FF 0%, ${C.core}CC 28%, ${C.glow}55 55%, transparent 75%)`,
          boxShadow: `0 0 ${r * 0.4}px ${C.glow}AA`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.7, 0], opacity: [0, 1, 0] }}
        transition={{ duration: impactD, delay: impactDelay + delay, ease: [0, 0.5, 1, 1] }}
      />
    )
  }

  function Ring({ delay = 0, scale = 1, width = 3, color = C.glow }: { delay?: number; scale?: number; width?: number; color?: string }) {
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

  function Sparks({ count = 6, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2
          const dist  = impactR * 0.55
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.38, height: size * 0.38, borderRadius: '50%',
                background: C.bright, boxShadow: `0 0 5px ${C.glow}`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{ x: [0, Math.cos(angle) * dist], y: [0, Math.sin(angle) * dist], opacity: [0, 1, 0], scale: [0, 1.1, 0] }}
              transition={{ duration: impactD * 0.75, delay: impactDelay + delay + i * 0.012 }}
            />
          )
        })}
      </>
    )
  }

  // ── Rarity variants ────────────────────────────────────────────────────────

  if (rarity === 'comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Fireball />
      <ImpactFlash />
    </div>
  )

  if (rarity === 'non_comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Fireball />
      <Ember delay={0.04} />
      <Ember delay={0.09} frac={0.3} />
      <ImpactFlash />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Fireball />
      <Ember delay={0.04} />
      <Ember delay={0.09} frac={0.32} />
      <Ember delay={0.14} frac={0.22} />
      <ImpactFlash />
      <Sparks count={6} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Fireball scale={1.1} />
      {[0.04, 0.08, 0.14, 0.2].map((d, i) => <Ember key={i} delay={d} frac={0.55 - i * 0.06} />)}
      <ImpactFlash scale={1.2} />
      <Ring />
      <Sparks count={8} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Pre-charge burst at origin */}
      <motion.div className="absolute pointer-events-none"
        style={{ width: size * 2.2, height: size * 2.2, borderRadius: '50%', background: `radial-gradient(circle, ${C.bright}88 0%, ${C.glow}44 50%, transparent 75%)`, transform: 'translate(-50%, -50%)' }}
        initial={{ left: coords.ox, top: coords.oy, scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 2.2, 0], opacity: [0, 0.75, 0] }}
        transition={{ duration: travelS * 0.35 }}
      />
      <Fireball scale={1.3} />
      {[0.04, 0.09, 0.15, 0.22, 0.3].map((d, i) => <Ember key={i} delay={d} frac={0.65 - i * 0.07} />)}
      <ImpactFlash scale={1.5} />
      <Ring scale={1.1} width={4} color={C.glow} />
      <Ring delay={0.08} scale={0.85} width={2} color={C.bright} />
      <Sparks count={10} />
    </div>
  )

  // mitologico
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Pre-charge rings */}
      {[0, 0.06, 0.12].map((d, i) => (
        <motion.div key={i} className="absolute pointer-events-none"
          style={{ width: size * 3, height: size * 3, borderRadius: '50%', border: `2px solid ${C.glow}${['AA', '66', '33'][i]}`, transform: 'translate(-50%, -50%)' }}
          initial={{ left: coords.ox, top: coords.oy, scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.6, 0], opacity: [0, 0.7, 0] }}
          transition={{ duration: travelS * 0.38, delay: d }}
        />
      ))}
      {/* Screen-wide tint on impact */}
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: `${C.glow}18` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: impactD * 0.6, delay: impactDelay }}
      />
      <Fireball scale={1.65} />
      {[0.04, 0.09, 0.15, 0.22, 0.3, 0.39].map((d, i) => <Ember key={i} delay={d} frac={0.78 - i * 0.08} />)}
      <ImpactFlash scale={2} />
      <Ring scale={1.2} width={4} color={C.bright} />
      <Ring delay={0.1} scale={1.5} width={3} color={C.glow} />
      <Ring delay={0.2} scale={1.8} width={2} color={C.ember} />
      <Sparks count={14} />
    </div>
  )
}
