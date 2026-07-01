'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'

// ─────────────────────────────────────────────────────────────────────────────
// Procedural ability VFX.
//
// The effect is COMPOSED automatically from the ability's element × category ×
// mechanics — no hand-authored animation per move. That means every ability an
// admin creates gets an on-theme effect for free:
//   • element  → colour palette + particle shape (fire embers, water droplets,
//                leaves, rock shards, harmony notes, neutral sparks)
//   • category → motion archetype (attack = projectiles→impact, status = drifting
//                cloud, cura = rising motes, potenziamento = aura rings, difesa =
//                shield dome)
//   • mechanics→ layered modifiers (charge = wind-up core, multi-hit = repeated
//                waves, recharge = final shockwave)
// ─────────────────────────────────────────────────────────────────────────────

export type AbilityFxCategory = 'attacco' | 'stato' | 'cura' | 'potenziamento' | 'difesa'
export type ParticleShape = 'circle' | 'droplet' | 'leaf' | 'shard' | 'note' | 'spark'

export interface AbilityFxSpec {
  element: string | null
  category: AbilityFxCategory
  color: string
  name: string
  charge?: boolean
  recharge?: boolean
  multiHit?: boolean
  target?: 'enemy' | 'self'
}

const ELEMENT_FX: Record<string, { colors: [string, string]; shape: ParticleShape }> = {
  fiamma:    { colors: ['#FF6B36', '#FFC24B'], shape: 'circle' },
  adriatico: { colors: ['#38BDF8', '#7DD3FC'], shape: 'droplet' },
  bosco:     { colors: ['#44D08A', '#A7F3D0'], shape: 'leaf' },
  terra:     { colors: ['#E0A24E', '#C9A227'], shape: 'shard' },
  armonia:   { colors: ['#C084FC', '#F0ABFC'], shape: 'note' },
  neutral:   { colors: ['#9CA3AF', '#E2E8F0'], shape: 'spark' },
}

function shapeStyle(shape: ParticleShape, color: string, size: number): React.CSSProperties {
  const base: React.CSSProperties = { width: size, height: size, background: color, boxShadow: `0 0 ${size}px ${color}` }
  switch (shape) {
    case 'circle':  return { ...base, borderRadius: '50%' }
    case 'droplet': return { ...base, borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)' }
    case 'leaf':    return { ...base, borderRadius: '0 60% 0 60%' }
    case 'shard':   return { ...base, borderRadius: 2, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }
    case 'note':    return { ...base, borderRadius: '50% 50% 50% 50%', boxShadow: `0 0 ${size}px ${color}, ${size * 0.5}px -${size * 0.6}px 0 -1px ${color}` }
    case 'spark':   return { ...base, width: size * 2.2, height: Math.max(2, size / 3), borderRadius: 4 }
  }
}

const rand = (seed: number) => {
  const x = Math.sin(seed * 999.13) * 43758.5453
  return x - Math.floor(x)
}

export default function AbilityFx({
  element, category, color, name, charge, recharge, multiHit, target = 'enemy', side = 'left', onComplete,
}: AbilityFxSpec & { side?: 'left' | 'right'; onComplete?: () => void }) {
  const durationMs = 1150 + (charge ? 450 : 0) + (recharge ? 250 : 0)

  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), durationMs)
    return () => clearTimeout(t)
  }, [onComplete, durationMs])

  const fx = ELEMENT_FX[element ?? 'neutral'] ?? ELEMENT_FX.neutral
  // caster origin / enemy target (percent of the arena)
  const casterX = side === 'left' ? 28 : 72
  const enemyX  = side === 'left' ? 72 : 28
  // self-targeted categories always resolve on the caster.
  const selfCategory = category === 'cura' || category === 'potenziamento' || category === 'difesa' || target === 'self'
  const focusX = selfCategory ? casterX : enemyX
  const chargeDelay = charge ? 0.42 : 0

  const particleColors = [fx.colors[0], fx.colors[1], color]

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 12 }}>
      <NameBanner name={name} color={color} duration={durationMs} />

      {/* Element-tinted screen flash at the focus point */}
      <motion.div className="absolute inset-0"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 0.24, 0] }}
        transition={{ duration: 0.5, delay: chargeDelay, times: [0, 0.3, 1] }}
        style={{ background: `radial-gradient(circle at ${focusX}% 48%, ${fx.colors[0]}55, transparent 58%)` }} />

      {/* Charge wind-up: particles converge into a growing core on the caster. */}
      {charge && <ChargeCore x={casterX} colors={fx.colors} shape={fx.shape} />}

      {/* Category-driven main effect */}
      {category === 'attacco' && (
        <AttackFx casterX={casterX} enemyX={enemyX} colors={particleColors} shape={fx.shape} delay={chargeDelay} waves={multiHit ? 3 : 1} />
      )}
      {category === 'stato' && (
        <StatusCloudFx casterX={casterX} enemyX={enemyX} colors={particleColors} shape={fx.shape} delay={chargeDelay} />
      )}
      {category === 'cura' && (
        <HealFx x={casterX} colors={particleColors} shape={fx.shape} delay={chargeDelay} />
      )}
      {category === 'potenziamento' && (
        <BuffFx x={casterX} colors={particleColors} shape={fx.shape} delay={chargeDelay} />
      )}
      {category === 'difesa' && (
        <ShieldFx x={casterX} color={fx.colors[0]} delay={chargeDelay} />
      )}

      {/* Recharge: a heavy final shockwave from the focus point. */}
      {recharge && <Shockwave x={focusX} color={fx.colors[1]} />}
    </div>
  )
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function NameBanner({ name, color, duration }: { name: string; color: string; duration: number }) {
  return (
    <motion.div
      className="absolute left-1/2 top-[15%] -translate-x-1/2 px-4 py-1.5 rounded-full"
      initial={{ opacity: 0, y: -14, scale: 0.8 }}
      animate={{ opacity: [0, 1, 1, 0], y: [-14, 0, 0, -8], scale: [0.8, 1, 1, 1] }}
      transition={{ duration: duration / 1000, times: [0, 0.16, 0.78, 1] }}
      style={{ background: 'rgba(6,13,25,0.72)', border: `1px solid ${color}`, boxShadow: `0 0 18px ${color}77`, backdropFilter: 'blur(4px)' }}
    >
      <span className="text-[13px] font-extrabold tracking-wide" style={{ color, textShadow: `0 0 10px ${color}aa` }}>{name}</span>
    </motion.div>
  )
}

function Particle({ shape, color, size, style }: { shape: ParticleShape; color: string; size: number; style?: React.CSSProperties }) {
  return <div className="absolute" style={{ ...shapeStyle(shape, color, size), ...style }} />
}

// ── Attack: projectiles fly caster→enemy, then an impact burst. Multi-hit repeats. ─
function AttackFx({ casterX, enemyX, colors, shape, delay, waves }: {
  casterX: number; enemyX: number; colors: string[]; shape: ParticleShape; delay: number; waves: number
}) {
  const count = 7
  return (
    <>
      {Array.from({ length: waves }).map((_, w) => {
        const wDelay = delay + w * 0.16
        return (
          <div key={w}>
            {Array.from({ length: count }).map((_, i) => {
              const c = colors[i % colors.length]
              const jitter = (rand(i + w * 10) - 0.5) * 16
              return (
                <motion.div key={i} className="absolute" style={{ left: `${casterX}%`, top: '50%' }}
                  initial={{ x: 0, y: jitter, opacity: 0, scale: 0.6 }}
                  animate={{ x: `${enemyX - casterX}%`, y: jitter, opacity: [0, 1, 1, 0], scale: [0.6, 1, 0.9, 0.4] }}
                  transition={{ duration: 0.34, delay: wDelay + i * 0.015, ease: 'easeIn', times: [0, 0.2, 0.8, 1] }}>
                  <Particle shape={shape} color={c} size={10} />
                </motion.div>
              )
            })}
            {/* impact ring at the enemy */}
            <motion.div className="absolute rounded-full" style={{ left: `${enemyX}%`, top: '50%', border: `3px solid ${colors[0]}`, translateX: '-50%', translateY: '-50%' }}
              initial={{ width: 20, height: 20, opacity: 0 }}
              animate={{ width: 150, height: 150, opacity: [0, 0.9, 0] }}
              transition={{ duration: 0.4, delay: wDelay + 0.28, ease: 'easeOut' }} />
          </div>
        )
      })}
    </>
  )
}

// ── Status: slow drifting orbs travel to the enemy and swirl/linger. ───────────
function StatusCloudFx({ casterX, enemyX, colors, shape, delay }: {
  casterX: number; enemyX: number; colors: string[]; shape: ParticleShape; delay: number
}) {
  return (
    <>
      {Array.from({ length: 14 }).map((_, i) => {
        const c = colors[i % colors.length]
        const oy = (rand(i) - 0.5) * 90
        const ox = (rand(i + 20) - 0.5) * 40
        return (
          <motion.div key={i} className="absolute" style={{ left: `${casterX}%`, top: '50%' }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x: `calc(${enemyX - casterX}% + ${ox}px)`, y: oy, opacity: [0, 0.95, 0.7, 0], scale: [0.4, 1, 1.1, 0.5] }}
            transition={{ duration: 0.9, delay: delay + i * 0.03, ease: 'easeOut' }}>
            <Particle shape={shape} color={c} size={9} />
          </motion.div>
        )
      })}
    </>
  )
}

// ── Cura: motes rise on the caster + a soft healing halo. ──────────────────────
function HealFx({ x, colors, shape, delay }: { x: number; colors: string[]; shape: ParticleShape; delay: number }) {
  return (
    <>
      <motion.div className="absolute rounded-full" style={{ left: `${x}%`, top: '56%', translateX: '-50%', translateY: '-50%', background: `radial-gradient(circle, ${colors[0]}55, transparent 68%)` }}
        initial={{ width: 40, height: 40, opacity: 0 }}
        animate={{ width: 170, height: 170, opacity: [0, 0.8, 0] }}
        transition={{ duration: 0.9, delay, ease: 'easeOut' }} />
      {Array.from({ length: 13 }).map((_, i) => {
        const c = colors[i % colors.length]
        const px = x + (rand(i) - 0.5) * 22
        return (
          <motion.div key={i} className="absolute" style={{ left: `${px}%`, top: '66%' }}
            initial={{ y: 0, opacity: 0, scale: 0.5 }}
            animate={{ y: -130 - (i % 4) * 18, opacity: [0, 1, 0], scale: [0.5, 1, 0.4] }}
            transition={{ duration: 1, delay: delay + (i % 6) * 0.07, ease: 'easeOut' }}>
            <Particle shape={shape} color={c} size={9} />
          </motion.div>
        )
      })}
    </>
  )
}

// ── Potenziamento: expanding aura rings + upward chevrons on the caster. ───────
function BuffFx({ x, colors, shape, delay }: { x: number; colors: string[]; shape: ParticleShape; delay: number }) {
  return (
    <>
      {[0, 1].map(i => (
        <motion.div key={i} className="absolute rounded-full" style={{ left: `${x}%`, top: '52%', border: `2px solid ${colors[0]}`, translateX: '-50%', translateY: '-50%' }}
          initial={{ width: 50, height: 50, opacity: 0.85 }}
          animate={{ width: 210, height: 210, opacity: 0 }}
          transition={{ duration: 0.8, delay: delay + i * 0.18, ease: 'easeOut' }} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => {
        const c = colors[i % colors.length]
        const px = x + (rand(i) - 0.5) * 26
        return (
          <motion.div key={`c${i}`} className="absolute" style={{ left: `${px}%`, top: '60%' }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -70, opacity: [0, 1, 0] }}
            transition={{ duration: 0.7, delay: delay + i * 0.05, ease: 'easeOut' }}>
            <Particle shape={shape} color={c} size={8} />
          </motion.div>
        )
      })}
    </>
  )
}

// ── Difesa: a hexagonal shield dome flashes over the caster. ───────────────────
function ShieldFx({ x, color, delay }: { x: number; color: string; delay: number }) {
  return (
    <motion.div className="absolute" style={{ left: `${x}%`, top: '50%', width: 150, height: 150, translateX: '-50%', translateY: '-50%' }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: [0.5, 1.1, 1], opacity: [0, 0.9, 0] }}
      transition={{ duration: 0.9, delay, ease: 'easeOut' }}>
      <div style={{
        width: '100%', height: '100%',
        clipPath: 'polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
        border: `2.5px solid ${color}`, background: `radial-gradient(circle, ${color}22, transparent 70%)`,
        boxShadow: `0 0 22px ${color}88`,
      }} />
    </motion.div>
  )
}

// ── Charge wind-up: particles converge into a pulsing core. ────────────────────
function ChargeCore({ x, colors, shape }: { x: number; colors: [string, string]; shape: ParticleShape }) {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2
        const c = i % 2 ? colors[0] : colors[1]
        return (
          <motion.div key={i} className="absolute" style={{ left: `${x}%`, top: '50%' }}
            initial={{ x: Math.cos(a) * 70, y: Math.sin(a) * 70, opacity: 0, scale: 0.6 }}
            animate={{ x: 0, y: 0, opacity: [0, 1, 0.4], scale: [0.6, 1, 0.4] }}
            transition={{ duration: 0.42, ease: 'easeIn' }}>
            <Particle shape={shape} color={c} size={9} />
          </motion.div>
        )
      })}
      <motion.div className="absolute rounded-full" style={{ left: `${x}%`, top: '50%', translateX: '-50%', translateY: '-50%', background: `radial-gradient(circle, ${colors[1]}, transparent 70%)` }}
        initial={{ width: 8, height: 8, opacity: 0.4 }}
        animate={{ width: [8, 70, 34], opacity: [0.4, 1, 0.9], height: [8, 70, 34] }}
        transition={{ duration: 0.42 }} />
    </>
  )
}

// ── Recharge shockwave ─────────────────────────────────────────────────────────
function Shockwave({ x, color }: { x: number; color: string }) {
  return (
    <motion.div className="absolute rounded-full" style={{ left: `${x}%`, top: '50%', border: `4px solid ${color}`, translateX: '-50%', translateY: '-50%' }}
      initial={{ width: 30, height: 30, opacity: 0.9 }}
      animate={{ width: 420, height: 420, opacity: 0 }}
      transition={{ duration: 0.55, delay: 0.5, ease: 'easeOut' }} />
  )
}
