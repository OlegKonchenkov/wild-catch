'use client'
import { motion } from 'framer-motion'
import type { StatusEffect } from '@/lib/game/combat'
import { STATUS_EFFECT_META } from '@/lib/game/combat'

/**
 * Ambient overlay rendered on a creature sprite while a status effect
 * is active. Sits on top of (or behind) the sprite, looping subtly so
 * the player can tell at a glance "this creature is paralyzed / asleep
 * / poisoned / confused" without having to read the badge.
 *
 * Per-status visual:
 *   paralisi   (⚡ giallo) → 4 sparks flicker around the sprite
 *   confusione (💫 viola)  → 4 stars rotate around the sprite center
 *   sonno      (💤 blu)    → "Z" emojis floating up and fading
 *   veleno     (☠️ verde)  → bubbles rising from the bottom
 *
 * Subtle by design: low opacity (~50%), small particles, slow loops,
 * so the effect reads as "atmosphere" rather than "VFX explosion".
 *
 * Layering: CreatureSprite renders its sprite image at z-10 (when
 * showAura is on) and the catch-net animation uses z-20. The status
 * aura must read as IN FRONT of the creature, so every particle layer
 * here is z-30 — above the sprite and the net, regardless of the
 * (z-auto) wrapper each call site uses.
 */
const FX_LAYER = 'absolute inset-0 pointer-events-none z-30'
interface Props {
  status: StatusEffect | null | undefined
  /** Approximate sprite size — used to scale particles to fit. */
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
      return <ConfusionStars color={meta.color} glow={meta.glow} size={size} />
    case 'sonno':
      return <SleepZs color={meta.color} size={size} />
    case 'veleno':
      return <PoisonBubbles color={meta.color} glow={meta.glow} size={size} />
    default:
      return null
  }
}

// ── Paralysis: 4 sparks flickering at fixed positions ───────────────────────
function ParalysisSparks({ color, glow, size }: { color: string; glow: string; size: number }) {
  const positions = [
    { x: -size * 0.35, y: -size * 0.30, delay: 0.0 },
    { x:  size * 0.30, y: -size * 0.25, delay: 0.2 },
    { x: -size * 0.25, y:  size * 0.30, delay: 0.4 },
    { x:  size * 0.32, y:  size * 0.32, delay: 0.6 },
  ]
  return (
    <div className={`${FX_LAYER} flex items-center justify-center`}>
      {positions.map((p, i) => (
        <motion.span
          key={i}
          className="absolute text-base"
          style={{
            x: p.x, y: p.y,
            color,
            textShadow: `0 0 8px ${glow}, 0 0 16px ${glow}`,
            fontSize: 18,
          }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.1, 0.6] }}
          transition={{ duration: 0.8, delay: p.delay, repeat: Infinity, repeatDelay: 0.4 }}
        >
          ⚡
        </motion.span>
      ))}
    </div>
  )
}

// ── Confusione: 4 stars rotating in a circle ────────────────────────────────
function ConfusionStars({ color, glow, size }: { color: string; glow: string; size: number }) {
  const radius = size * 0.45
  return (
    <motion.div
      className={`${FX_LAYER} flex items-center justify-center`}
      animate={{ rotate: 360 }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
    >
      {[0, 90, 180, 270].map(angle => (
        <span
          key={angle}
          className="absolute"
          style={{
            transform: `rotate(${angle}deg) translate(${radius}px) rotate(-${angle}deg)`,
            color,
            textShadow: `0 0 10px ${glow}`,
            fontSize: 16,
            opacity: 0.85,
          }}
        >
          💫
        </span>
      ))}
    </motion.div>
  )
}

// ── Sonno: "Z" emojis floating up ──────────────────────────────────────────
function SleepZs({ color, size }: { color: string; size: number }) {
  const items = [0, 1, 2]
  return (
    <div className={`${FX_LAYER} flex items-center justify-center`}>
      {items.map(i => (
        <motion.span
          key={i}
          className="absolute font-black"
          style={{
            color,
            fontSize: 18 + i * 4,
            textShadow: `0 0 8px rgba(96,165,250,0.6)`,
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

// ── Veleno: bubbles rising from below the sprite ───────────────────────────
function PoisonBubbles({ color, glow, size }: { color: string; glow: string; size: number }) {
  const bubbles = [
    { x: -size * 0.20, delay: 0.0, sz: 6 },
    { x:  size * 0.12, delay: 0.6, sz: 8 },
    { x: -size * 0.05, delay: 1.2, sz: 5 },
    { x:  size * 0.25, delay: 1.8, sz: 7 },
  ]
  return (
    <div className={FX_LAYER}>
      {bubbles.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.sz,
            height: b.sz,
            left: '50%',
            background: color,
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
