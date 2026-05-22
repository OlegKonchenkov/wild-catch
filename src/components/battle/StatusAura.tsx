'use client'
import { motion } from 'framer-motion'
import type { StatusEffect } from '@/lib/game/combat'
import { STATUS_EFFECT_META } from '@/lib/game/combat'

/**
 * Ambient overlay rendered on a creature sprite while a status effect is active.
 * The new immersive scene needs this to feel like premium VFX, so the visible
 * layer uses CSS particles instead of relying on emoji glyphs.
 */
const FX_LAYER = 'absolute inset-0 pointer-events-none z-30'

interface Props {
  status: StatusEffect | null | undefined
  /** Approximate sprite size, used to scale particles to fit. */
  size?: number
}

export default function StatusAura({ status, size = 120 }: Props) {
  if (!status) return null
  const meta = STATUS_EFFECT_META[status]
  if (!meta) return null

  switch (status) {
    case 'paralisi':
      return <ParalysisSparks color={meta.color} glow={meta.glow} size={size} />
    case 'confusione':
      return <ConfusionOrbit color={meta.color} glow={meta.glow} size={size} />
    case 'sonno':
      return <SleepZs color={meta.color} size={size} />
    case 'veleno':
      return <PoisonMist color={meta.color} glow={meta.glow} size={size} />
    default:
      return null
  }
}

function ParalysisSparks({ color, glow, size }: { color: string; glow: string; size: number }) {
  const positions = [
    { x: -size * 0.38, y: -size * 0.28, rot: -24, delay: 0.0 },
    { x: size * 0.32, y: -size * 0.31, rot: 22, delay: 0.18 },
    { x: -size * 0.27, y: size * 0.30, rot: 18, delay: 0.36 },
    { x: size * 0.34, y: size * 0.24, rot: -18, delay: 0.54 },
  ]

  return (
    <div className={`${FX_LAYER} flex items-center justify-center`} data-status-aura="paralisi">
      {positions.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{
            x: p.x,
            y: p.y,
            width: Math.max(16, size * 0.11),
            height: Math.max(26, size * 0.18),
            rotate: p.rot,
            clipPath: 'polygon(48% 0%, 78% 0%, 58% 38%, 92% 38%, 28% 100%, 43% 55%, 12% 55%)',
            background: `linear-gradient(180deg, rgba(255,255,255,.95), ${color} 45%, rgba(255,255,255,.72))`,
            filter: `drop-shadow(0 0 5px ${glow}) drop-shadow(0 0 12px ${glow})`,
          }}
          animate={{ opacity: [0, 1, 0.2, 0], scale: [0.55, 1.08, 0.92, 0.6] }}
          transition={{ duration: 0.9, delay: p.delay, repeat: Infinity, repeatDelay: 0.34 }}
        />
      ))}
      <motion.span
        className="absolute rounded-full"
        style={{
          width: size * 0.82,
          height: size * 0.82,
          border: `1px solid ${color}44`,
          boxShadow: `0 0 ${Math.max(18, size * 0.14)}px ${glow}`,
        }}
        animate={{ opacity: [0.08, 0.28, 0.08], scale: [0.9, 1.02, 0.9] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

function ConfusionOrbit({ color, glow, size }: { color: string; glow: string; size: number }) {
  const radius = size * 0.45

  return (
    <motion.div
      className={`${FX_LAYER} flex items-center justify-center`}
      data-status-aura="confusione"
      animate={{ rotate: 360 }}
      transition={{ duration: 4.2, repeat: Infinity, ease: 'linear' }}
    >
      {[0, 72, 156, 238, 306].map((angle, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{
            transform: `rotate(${angle}deg) translate(${radius}px) rotate(-${angle}deg)`,
            width: Math.max(9, size * 0.055),
            height: Math.max(9, size * 0.055),
            borderRadius: i % 2 ? '50%' : '35%',
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.94), ${color} 48%, transparent 78%)`,
            boxShadow: `0 0 10px ${glow}`,
          }}
          animate={{ scale: [0.62, 1.18, 0.62], opacity: [0.38, 0.92, 0.38] }}
          transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
        />
      ))}
      <span
        className="absolute rounded-full"
        style={{
          width: size * 0.72,
          height: size * 0.72,
          border: `1px solid ${color}36`,
          boxShadow: `inset 0 0 ${Math.max(12, size * 0.09)}px ${glow}`,
        }}
      />
    </motion.div>
  )
}

function SleepZs({ color, size }: { color: string; size: number }) {
  const items = [0, 1, 2]

  return (
    <div className={`${FX_LAYER} flex items-center justify-center`} data-status-aura="sonno">
      {items.map(i => (
        <motion.span
          key={i}
          className="absolute font-black italic"
          style={{
            color,
            fontSize: 18 + i * 4,
            letterSpacing: 0,
            textShadow: '0 0 8px rgba(96,165,250,0.7), 0 0 18px rgba(59,130,246,0.35)',
          }}
          initial={{ y: size * 0.15, x: -10 + i * 6, opacity: 0 }}
          animate={{
            y: -size * 0.45,
            opacity: [0, 0.9, 0],
            x: -10 + i * 6 + (i === 1 ? 6 : -4),
          }}
          transition={{
            duration: 2.2,
            delay: i * 0.65,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        >
          Z
        </motion.span>
      ))}
    </div>
  )
}

function PoisonMist({ color, glow, size }: { color: string; glow: string; size: number }) {
  const bubbles = [
    { x: -size * 0.22, delay: 0.0, sz: 6 },
    { x: size * 0.14, delay: 0.55, sz: 8 },
    { x: -size * 0.05, delay: 1.1, sz: 5 },
    { x: size * 0.28, delay: 1.65, sz: 7 },
  ]

  return (
    <div className={FX_LAYER} data-status-aura="veleno">
      <motion.div
        className="absolute left-1/2 rounded-full"
        style={{
          bottom: size * 0.1,
          width: size * 0.62,
          height: size * 0.18,
          marginLeft: -(size * 0.62) / 2,
          background: `radial-gradient(ellipse at center, ${color}34, transparent 72%)`,
          filter: 'blur(8px)',
          boxShadow: `0 0 ${Math.max(16, size * 0.1)}px ${glow}`,
        }}
        animate={{ opacity: [0.18, 0.42, 0.18], scale: [0.9, 1.08, 0.9] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {bubbles.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.sz,
            height: b.sz,
            left: '50%',
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.9), ${color} 54%, rgba(0,0,0,.12))`,
            boxShadow: `0 0 8px ${glow}`,
            transform: `translateX(${b.x}px)`,
          }}
          initial={{ y: size * 0.50, opacity: 0, scale: 0.4 }}
          animate={{ y: -size * 0.40, opacity: [0, 0.8, 0], scale: [0.4, 1, 0.6] }}
          transition={{
            duration: 2.4,
            delay: b.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}
