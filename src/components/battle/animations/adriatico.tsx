'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import { wave } from './paths'
import type { AttackAnimationProps } from './types'

const C = {
  bright: '#AAEEFF',
  core:   '#00C4E8',
  glow:   '#0088CC',
  deep:   '#005599',
  drop:   '#66DDFF',
  foam:   '#E8FBFF',
}
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function AdriaticoAttack({ rarity, side, onComplete }: AttackAnimationProps) {
  const coords = ATTACK_COORDS[side as 'left' | 'right'] ?? ATTACK_COORDS.left
  const timing = RARITY_TIMING[rarity] ?? RARITY_TIMING.comune
  const size   = RARITY_SIZE[rarity] ?? 18
  const travelS  = timing.travel / 1000
  const impactD  = (timing.total - timing.travel) / 1000
  const impactDelay = timing.travel / 1000
  const impactR  = size * 4.5
  const path = wave(coords, rarity === 'mitologico' ? 9 : rarity === 'leggendario' ? 8 : 6)

  useEffect(() => {
    if (!onComplete) return
    const t = setTimeout(onComplete, timing.total + 100)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pieces ───────────────────────────────────────────────────────────────────

  function Bubble({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const s = size * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s, borderRadius: '50%',
          background: `radial-gradient(circle at 32% 32%, ${C.foam} 0%, ${C.bright} 30%, ${C.core} 60%, ${C.glow} 88%, transparent 100%)`,
          boxShadow: `0 0 ${s}px ${C.core}DD, 0 0 ${s * 2}px ${C.core}44, inset 0 0 ${s * 0.4}px ${C.foam}66`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.35 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 1, 1, 0.9, 0],
          scale: [0.35, 1, 1.04, 0.95, 0.4],
        }}
        transition={{ duration: travelS, delay, ease: EASE, times: [0, 0.12, 0.55, 0.85, 1] }}
      />
    )
  }

  /** Streaming droplet trail behind the bubble. */
  function DropletStream({ delay = 0, frac = 0.4 }: { delay?: number; frac?: number }) {
    const s = size * frac
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s * 1.6, height: s * 0.7,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${C.bright} 0%, ${C.core}AA 60%, transparent 100%)`,
          boxShadow: `0 0 6px ${C.core}AA`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(0.4px)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 0.85, 0.55, 0],
          scale: [0.3, 0.8, 0.45, 0.1],
        }}
        transition={{ duration: travelS * 0.86, delay, ease: EASE }}
      />
    )
  }

  /** Flat splash disc — water spreads horizontally on impact. */
  function SplashDisc({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r * 1.5, height: r * 0.55,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${C.foam}EE 0%, ${C.bright}CC 25%, ${C.core}66 55%, transparent 80%)`,
          boxShadow: `0 0 ${r * 0.3}px ${C.core}AA`,
          transform: 'translate(-50%, -40%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.4, 1.6, 0], opacity: [0, 1, 0.6, 0] }}
        transition={{ duration: impactD, delay: impactDelay + delay, ease: [0, 0.5, 1, 1], times: [0, 0.25, 0.55, 1] }}
      />
    )
  }

  /** Vertical splash crown — droplets shooting up from impact point. */
  function SplashCrown({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r * 0.7, height: r,
          borderRadius: '50% 50% 30% 30% / 60% 60% 40% 40%',
          background: `radial-gradient(ellipse at 50% 80%, ${C.foam}DD 0%, ${C.bright}AA 40%, ${C.core}55 75%, transparent 100%)`,
          transform: 'translate(-50%, -65%)',
          filter: 'blur(0.3px)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 1.05, 0], opacity: [0, 0.95, 0.7, 0] }}
        transition={{ duration: impactD * 0.9, delay: impactDelay + delay }}
      />
    )
  }

  function Ripple({ delay = 0, scale = 1, width = 2, color = C.core }: { delay?: number; scale?: number; width?: number; color?: string }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r * 1.2, height: r * 0.5,
          borderRadius: '50%',
          border: `${width}px solid ${color}CC`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.4, 2.6], opacity: [0, 0.85, 0] }}
        transition={{ duration: impactD * 0.92, delay: impactDelay + delay }}
      />
    )
  }

  /** Falling rain droplets at the impact site. */
  function FallingRain({ count = 8, delay = 0, sustainS = 0.4 }: { count?: number; delay?: number; sustainS?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = -Math.PI / 2 + ((i / count) - 0.5) * Math.PI * 0.85
          const dist  = impactR * (0.5 + (i % 3) * 0.18)
          const fall  = impactR * 0.45
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.22, height: size * 0.44,
                borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%',
                background: `linear-gradient(180deg, ${C.foam} 0%, ${C.core} 100%)`,
                boxShadow: `0 0 4px ${C.core}AA`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{
                x: [0, Math.cos(angle) * dist],
                y: [0, Math.sin(angle) * dist - 4, Math.sin(angle) * dist + fall],
                opacity: [0, 1, 0.9, 0],
                scale: [0, 1, 1, 0.6],
              }}
              transition={{ duration: sustainS, delay: impactDelay + delay + i * 0.025, times: [0, 0.18, 0.55, 1] }}
            />
          )
        })}
      </>
    )
  }

  /** Foam particles — small white specks that scatter low and fade. */
  function FoamSpray({ count = 6, delay = 0 }: { count?: number; delay?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI - Math.PI * 0.05
          const dist  = impactR * 0.7
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: size * 0.32, height: size * 0.32, borderRadius: '50%',
                background: C.foam, boxShadow: `0 0 5px ${C.core}`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{
                x: [0, Math.cos(angle) * dist],
                y: [0, Math.sin(angle) * dist],
                opacity: [0, 1, 0],
                scale: [0, 1.15, 0],
              }}
              transition={{ duration: impactD * 0.78, delay: impactDelay + delay + i * 0.014 }}
            />
          )
        })}
      </>
    )
  }

  /** Whirlpool — rotating ring at impact. */
  function Whirlpool({ delay = 0, scale = 1, width = 3 }: { delay?: number; scale?: number; width?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r * 1.4, height: r * 0.55,
          borderRadius: '50%',
          border: `${width}px solid ${C.glow}BB`,
          borderTopColor: `${C.bright}DD`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0, rotate: 0 }}
        animate={{ scale: [0.1, 1.5, 2.2], opacity: [0, 0.85, 0], rotate: 360 }}
        transition={{ duration: impactD * 0.95, delay: impactDelay + delay }}
      />
    )
  }

  /** Tidal wave wall — horizontal sweeping wave at impact. */
  function TidalWall({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r * 2, height: r * 0.9,
          borderRadius: '40% 60% 30% 70% / 60% 40% 60% 40%',
          background: `linear-gradient(180deg, ${C.foam}DD 0%, ${C.bright}BB 30%, ${C.core}77 70%, transparent 100%)`,
          boxShadow: `0 0 ${r * 0.3}px ${C.core}99`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(0.6px)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scaleX: 0.1, scaleY: 0.3, opacity: 0 }}
        animate={{ scaleX: [0.1, 1.3, 1.6, 0], scaleY: [0.3, 1, 0.8, 0.4], opacity: [0, 0.95, 0.7, 0] }}
        transition={{ duration: impactD * 1.05, delay: impactDelay + delay, times: [0, 0.3, 0.6, 1] }}
      />
    )
  }

  /** Geyser column — vertical water pillar rising at impact. */
  function GeyserColumn({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const w = size * 0.9 * scale
    const h = impactR * 1.2 * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: w, height: h,
          borderRadius: '50% 50% 40% 40% / 30% 30% 70% 70%',
          background: `linear-gradient(180deg, ${C.foam}EE 0%, ${C.bright}CC 25%, ${C.core}88 60%, ${C.glow}55 100%)`,
          boxShadow: `0 0 ${w}px ${C.core}AA`,
          transform: 'translate(-50%, -100%)',
          filter: 'blur(0.5px)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scaleY: 0, opacity: 0 }}
        animate={{ scaleY: [0, 1.05, 1, 0.5, 0], opacity: [0, 1, 0.95, 0.5, 0] }}
        transition={{ duration: impactD * 1.05, delay: impactDelay + delay, times: [0, 0.3, 0.6, 0.85, 1] }}
      />
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
        animate={{ scale: [0.2, 1.2, 0], opacity: [0, 0.85, 0] }}
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
      <DropletStream frac={0.4} />
      <Bubble />
      <SplashDisc />
      <Ripple />
    </div>
  )

  if (rarity === 'non_comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <DropletStream frac={0.45} />
      <DropletStream delay={0.04} frac={0.32} />
      <Bubble />
      <SplashDisc />
      <SplashCrown />
      <Ripple />
      <FoamSpray count={5} />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[0.0, 0.04, 0.09].map((d, i) => <DropletStream key={i} delay={d} frac={0.5 - i * 0.07} />)}
      <Bubble />
      <Bubble delay={0.07} scale={0.5} />
      <SplashDisc />
      <SplashCrown />
      <Ripple />
      <Ripple delay={0.12} scale={0.75} width={2} />
      <FoamSpray count={7} />
      <FallingRain count={5} sustainS={Math.min(0.32, impactD * 0.85)} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2} durFrac={0.3} />
      {[0.0, 0.05, 0.1, 0.15].map((d, i) => <DropletStream key={i} delay={d} frac={0.55 - i * 0.07} />)}
      <Bubble scale={1.12} />
      <Bubble delay={0.08} scale={0.55} />
      <SplashDisc scale={1.2} />
      <SplashCrown scale={1.15} />
      <Ripple />
      <Ripple delay={0.12} scale={0.78} />
      <Whirlpool scale={0.9} />
      <FoamSpray count={8} />
      <FallingRain count={7} sustainS={Math.min(0.4, impactD * 0.85)} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2.6} durFrac={0.35} />
      {[0.0, 0.05, 0.1, 0.16, 0.22].map((d, i) => <DropletStream key={i} delay={d} frac={0.65 - i * 0.08} />)}
      <Bubble scale={1.35} />
      <Bubble delay={0.08} scale={0.55} />
      <SplashDisc scale={1.4} />
      <SplashCrown scale={1.3} />
      <TidalWall scale={1.0} />
      <Whirlpool scale={1.1} width={3} />
      <Ripple scale={1.1} width={3} />
      <Ripple delay={0.12} scale={0.85} />
      <Ripple delay={0.24} scale={0.6} color={C.bright} />
      <FoamSpray count={10} />
      <FallingRain count={9} sustainS={Math.min(0.5, impactD * 0.78)} />
    </div>
  )

  // mitologico — tsunami + geyser
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[0, 0.06, 0.12].map((d, i) => (
        <motion.div key={`pc-${i}`} className="absolute pointer-events-none"
          style={{ width: size * 3.2, height: size * 3.2, borderRadius: '50%', border: `2px solid ${C.core}${['CC', '88', '44'][i]}`, transform: 'translate(-50%, -50%)' }}
          initial={{ left: coords.ox, top: coords.oy, scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1.7, 0], opacity: [0, 0.8, 0], rotate: -120 }}
          transition={{ duration: travelS * 0.4, delay: d }}
        />
      ))}
      <ScreenTint alpha="18" />
      {[0, 0.05, 0.1, 0.16, 0.22, 0.3].map((d, i) => <DropletStream key={i} delay={d} frac={0.78 - i * 0.09} />)}
      <Bubble scale={1.7} />
      <Bubble delay={0.08} scale={0.55} />
      <Bubble delay={0.16} scale={0.4} />
      <SplashDisc scale={1.7} />
      <SplashCrown scale={1.55} />
      <GeyserColumn scale={1.0} />
      <TidalWall scale={1.3} />
      <Whirlpool scale={1.3} width={3} />
      <Whirlpool delay={0.18} scale={0.95} width={2} />
      <Ripple scale={1.2} width={3} />
      <Ripple delay={0.12} scale={1.5} />
      <Ripple delay={0.25} scale={1.8} color={C.bright} />
      <FoamSpray count={14} />
      <FallingRain count={14} sustainS={Math.min(0.7, impactD * 0.82)} />
    </div>
  )
}
