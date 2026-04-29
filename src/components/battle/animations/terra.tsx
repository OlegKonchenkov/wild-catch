'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ATTACK_COORDS, RARITY_TIMING, RARITY_SIZE } from './types'
import { ballistic } from './paths'
import type { AttackAnimationProps } from './types'

const C = {
  bright: '#F0D090',
  core:   '#D4A060',
  glow:   '#A06830',
  rock:   '#8B5A2B',
  deep:   '#5A3818',
  ember:  '#FFA040',
}
const EASE: [number, number, number, number] = [0.22, 0, 0.68, 1]

export default function TerraAttack({ rarity, side, onComplete }: AttackAnimationProps) {
  const coords = ATTACK_COORDS[side as 'left' | 'right'] ?? ATTACK_COORDS.left
  const timing = RARITY_TIMING[rarity] ?? RARITY_TIMING.comune
  const size   = RARITY_SIZE[rarity] ?? 18
  const travelS  = timing.travel / 1000
  const impactD  = (timing.total - timing.travel) / 1000
  const impactDelay = timing.travel / 1000
  const impactR  = size * 4.5
  const path = ballistic(coords, rarity === 'mitologico' ? 22 : rarity === 'leggendario' ? 20 : 16)

  useEffect(() => {
    if (!onComplete) return
    const t = setTimeout(onComplete, timing.total + 100)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pieces ───────────────────────────────────────────────────────────────────

  function Rock({ delay = 0, scale = 1, spinDir = 1 }: { delay?: number; scale?: number; spinDir?: 1 | -1 }) {
    const s = size * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s,
          background: `radial-gradient(circle at 38% 32%, ${C.bright} 0%, ${C.core} 38%, ${C.rock} 75%, ${C.deep} 100%)`,
          clipPath: 'polygon(28% 0%, 72% 0%, 100% 28%, 100% 72%, 72% 100%, 28% 100%, 0% 72%, 0% 28%)',
          boxShadow: `0 0 ${s * 0.7}px ${C.glow}AA, 0 ${s * 0.15}px ${s * 0.4}px ${C.deep}77`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.4, rotate: 0 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 1, 1, 1, 0.9],
          scale: [0.4, 1, 1.05, 1, 0.55],
          rotate: [0, 240 * spinDir, 480 * spinDir],
        }}
        transition={{ duration: travelS, delay, ease: EASE, times: [0, 0.12, 0.55, 0.85, 1] }}
      />
    )
  }

  /** Trail of pebbles dropping behind the rock. */
  function PebbleTrail({ delay = 0, frac = 0.35 }: { delay?: number; frac?: number }) {
    const s = size * frac
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s, height: s,
          background: C.rock,
          clipPath: 'polygon(25% 0%, 75% 0%, 100% 30%, 80% 100%, 20% 100%, 0% 30%)',
          boxShadow: `0 0 4px ${C.glow}77`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.3, rotate: 0 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 0.9, 0.6, 0],
          scale: [0.3, 0.85, 0.4, 0.1],
          rotate: [0, 320],
          y: [0, 4, 12],
        }}
        transition={{ duration: travelS * 0.85, delay, ease: EASE, times: [0, 0.2, 0.7, 1] }}
      />
    )
  }

  /** Dust puff trail. */
  function DustPuff({ delay = 0, frac = 0.42 }: { delay?: number; frac?: number }) {
    const s = size * frac
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: s * 1.5, height: s * 1.1, borderRadius: '50%',
          background: `radial-gradient(ellipse, ${C.bright}77 0%, ${C.core}44 50%, transparent 78%)`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(0.6px)',
        }}
        initial={{ left: coords.ox, top: coords.oy, opacity: 0, scale: 0.4 }}
        animate={{
          left: path.left, top: path.top,
          opacity: [0, 0.7, 0.4, 0],
          scale: [0.4, 1.2, 1.6, 0.2],
        }}
        transition={{ duration: travelS * 0.82, delay, ease: EASE }}
      />
    )
  }

  /** Crater impact — bright flash. */
  function ImpactCrater({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r, height: r * 0.85, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.bright}FF 0%, ${C.ember}DD 18%, ${C.core}99 38%, ${C.glow}55 60%, transparent 78%)`,
          boxShadow: `0 0 ${r * 0.4}px ${C.ember}AA`,
          transform: 'translate(-50%, -45%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.7, 1.3, 0], opacity: [0, 1, 0.8, 0] }}
        transition={{ duration: impactD, delay: impactDelay + delay, ease: [0, 0.5, 1, 1], times: [0, 0.2, 0.55, 1] }}
      />
    )
  }

  /** Horizontal shockwave — compressed ellipse expanding. */
  function Shockwave({ delay = 0, scale = 1, width = 3 }: { delay?: number; scale?: number; width?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r * 1.6, height: r * 0.5, borderRadius: '50%',
          border: `${width}px solid ${C.bright}DD`,
          boxShadow: `0 0 ${r * 0.2}px ${C.glow}AA`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.2, 2.4], opacity: [0, 0.95, 0] }}
        transition={{ duration: impactD * 0.85, delay: impactDelay + delay }}
      />
    )
  }

  /** Settling dust cloud — billowing slowly outward. */
  function DustCloud({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) {
    const r = impactR * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: r * 1.6, height: r * 1.0, borderRadius: '50%',
          background: `radial-gradient(ellipse, ${C.bright}66 0%, ${C.core}44 40%, ${C.rock}22 70%, transparent 85%)`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(2px)',
          mixBlendMode: 'multiply',
        }}
        initial={{ left: coords.ix, top: coords.iy, scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.1, 1.8, 2.2], opacity: [0, 0.85, 0.55, 0] }}
        transition={{ duration: impactD, delay: impactDelay + delay, times: [0, 0.3, 0.7, 1] }}
      />
    )
  }

  /** Debris chunks scattering with rotation. */
  function Debris({ count = 6, delay = 0, spread = 0.62 }: { count?: number; delay?: number; spread?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2
          const dist  = impactR * spread * (0.85 + (i % 3) * 0.1)
          const s = size * (0.28 + (i % 3) * 0.08)
          const grav = impactR * 0.15
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: s, height: s,
                background: i % 2 ? C.core : C.rock,
                clipPath: 'polygon(25% 0%, 75% 0%, 100% 30%, 80% 100%, 20% 100%, 0% 30%)',
                boxShadow: `0 0 4px ${C.glow}66`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ left: coords.ix, top: coords.iy, x: 0, y: 0, opacity: 0, scale: 0, rotate: 0 }}
              animate={{
                x: [0, Math.cos(angle) * dist],
                y: [0, Math.sin(angle) * dist - 6, Math.sin(angle) * dist + grav],
                opacity: [0, 1, 0.85, 0],
                scale: [0, 1.1, 1, 0],
                rotate: [0, 200 + i * 30],
              }}
              transition={{ duration: impactD * 0.85, delay: impactDelay + delay + i * 0.012, times: [0, 0.25, 0.65, 1] }}
            />
          )
        })}
      </>
    )
  }

  /** Radial ground crack — multiple thin lines extending from impact. */
  function CrackNetwork({ count = 4, delay = 0, length = 0.6 }: { count?: number; delay?: number; length?: number }) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 + Math.PI / count
          const len   = impactR * length
          const wig   = (i % 2 ? 1 : -1) * 4
          return (
            <motion.div key={i} className="absolute pointer-events-none"
              style={{
                width: len, height: 2,
                background: `linear-gradient(90deg, ${C.deep} 0%, ${C.rock}AA 50%, transparent 100%)`,
                transformOrigin: '0 50%',
                transform: `translate(-50%, -50%) rotate(${(angle * 180) / Math.PI}deg) skewY(${wig}deg)`,
                boxShadow: `0 0 3px ${C.deep}AA`,
              }}
              initial={{ left: coords.ix, top: coords.iy, scaleX: 0, opacity: 0 }}
              animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 0.9, 0.85, 0] }}
              transition={{ duration: impactD * 0.95, delay: impactDelay + delay + i * 0.02, times: [0, 0.3, 0.7, 1] }}
            />
          )
        })}
      </>
    )
  }

  /** Stone pillar rising from the impact then crumbling. */
  function StonePillar({ delay = 0, scale = 1 }: { delay?: number; scale?: number }) {
    const w = size * 1.3 * scale
    const h = impactR * 1.4 * scale
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: w, height: h,
          background: `linear-gradient(180deg, ${C.bright} 0%, ${C.core} 30%, ${C.rock} 70%, ${C.deep} 100%)`,
          clipPath: 'polygon(18% 0%, 82% 0%, 100% 12%, 92% 100%, 8% 100%, 0% 12%)',
          boxShadow: `0 0 ${w * 0.6}px ${C.glow}AA`,
          transform: 'translate(-50%, -100%)',
        }}
        initial={{ left: coords.ix, top: coords.iy, scaleY: 0, opacity: 0 }}
        animate={{ scaleY: [0, 1.05, 1, 0.5, 0], opacity: [0, 1, 0.95, 0.6, 0] }}
        transition={{ duration: impactD * 1.05, delay: impactDelay + delay, times: [0, 0.3, 0.6, 0.85, 1] }}
      />
    )
  }

  /** Pre-charge — ground rumble dust at origin. */
  function PreCharge({ scale = 2.5, durFrac = 0.32 }: { scale?: number; durFrac?: number }) {
    return (
      <motion.div className="absolute pointer-events-none"
        style={{
          width: size * scale, height: size * scale * 0.75, borderRadius: '50%',
          background: `radial-gradient(ellipse, ${C.bright}88 0%, ${C.core}44 50%, transparent 75%)`,
          boxShadow: `0 0 ${size * 0.7}px ${C.glow}77`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(1px)',
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
        style={{ background: `${C.rock}${alpha}` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: impactD * 0.55, delay: impactDelay }}
      />
    )
  }

  // ── Variants ─────────────────────────────────────────────────────────────────

  if (rarity === 'comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <DustPuff frac={0.4} />
      <Rock />
      <ImpactCrater />
      <DustCloud scale={0.85} />
    </div>
  )

  if (rarity === 'non_comune') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <DustPuff />
      <PebbleTrail delay={0.05} frac={0.32} />
      <Rock />
      <ImpactCrater />
      <DustCloud />
      <Shockwave width={2} />
    </div>
  )

  if (rarity === 'raro') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[0.0, 0.06, 0.12].map((d, i) => <DustPuff key={i} delay={d} frac={0.45 - i * 0.07} />)}
      <PebbleTrail delay={0.05} frac={0.32} />
      <Rock />
      <ImpactCrater />
      <DustCloud />
      <Shockwave />
      <Debris count={6} />
      <CrackNetwork count={4} />
    </div>
  )

  if (rarity === 'epico') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2.2} durFrac={0.3} />
      {[0.0, 0.06, 0.12, 0.18].map((d, i) => <DustPuff key={i} delay={d} frac={0.55 - i * 0.07} />)}
      <PebbleTrail delay={0.05} frac={0.36} />
      <PebbleTrail delay={0.12} frac={0.28} />
      <Rock scale={1.12} />
      <ImpactCrater scale={1.2} />
      <Shockwave scale={1.1} width={3} />
      <Shockwave delay={0.1} scale={0.7} width={2} />
      <DustCloud scale={1.1} />
      <Debris count={8} />
      <CrackNetwork count={5} length={0.65} />
    </div>
  )

  if (rarity === 'leggendario') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <PreCharge scale={2.8} durFrac={0.35} />
      {[0.0, 0.06, 0.12, 0.18, 0.25].map((d, i) => <DustPuff key={i} delay={d} frac={0.62 - i * 0.07} />)}
      <PebbleTrail delay={0.05} frac={0.4} />
      <PebbleTrail delay={0.12} frac={0.3} />
      {/* Triple rock barrage */}
      <Rock scale={1.3} />
      <Rock delay={0.06} scale={0.55} spinDir={-1} />
      <Rock delay={0.13} scale={0.42} />
      <ImpactCrater scale={1.5} />
      <ImpactCrater scale={0.9} delay={0.12} />
      <StonePillar scale={0.85} />
      <Shockwave scale={1.2} width={4} />
      <Shockwave delay={0.1} scale={0.85} width={2} />
      <DustCloud scale={1.3} />
      <DustCloud delay={0.15} scale={0.85} />
      <Debris count={10} spread={0.7} />
      <CrackNetwork count={6} length={0.72} />
    </div>
  )

  // mitologico — meteoric boulder + stone pillars
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[0, 0.06, 0.12].map((d, i) => (
        <motion.div key={`pc-${i}`} className="absolute pointer-events-none"
          style={{ width: size * 3.2, height: size * 3.2, borderRadius: '50%', border: `2px solid ${C.glow}${['CC', '88', '44'][i]}`, transform: 'translate(-50%, -50%)' }}
          initial={{ left: coords.ox, top: coords.oy, scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1.7, 0], opacity: [0, 0.8, 0], rotate: 90 }}
          transition={{ duration: travelS * 0.4, delay: d }}
        />
      ))}
      <ScreenTint alpha="22" />
      {[0, 0.06, 0.12, 0.18, 0.25, 0.32].map((d, i) => <DustPuff key={i} delay={d} frac={0.78 - i * 0.09} />)}
      <PebbleTrail delay={0.05} frac={0.5} />
      <PebbleTrail delay={0.12} frac={0.38} />
      <PebbleTrail delay={0.2} frac={0.28} />
      {/* Boulder barrage */}
      <Rock scale={1.65} />
      <Rock delay={0.06} scale={0.6} spinDir={-1} />
      <Rock delay={0.13} scale={0.45} />
      <Rock delay={0.2} scale={0.36} spinDir={-1} />
      <ImpactCrater scale={1.95} />
      <ImpactCrater scale={1.2} delay={0.12} />
      {/* Multiple stone pillars rising in fan */}
      <StonePillar scale={1.1} />
      <StonePillar delay={0.12} scale={0.75} />
      <Shockwave scale={1.3} width={4} />
      <Shockwave delay={0.1} scale={1.6} width={3} />
      <Shockwave delay={0.22} scale={1.95} width={2} />
      <DustCloud scale={1.5} />
      <DustCloud delay={0.15} scale={1.0} />
      <DustCloud delay={0.3} scale={0.7} />
      <Debris count={14} spread={0.78} />
      <CrackNetwork count={8} length={0.85} />
    </div>
  )
}
