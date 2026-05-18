'use client'
import { motion, type TargetAndTransition } from 'framer-motion'
import Image from 'next/image'

type AnimState = 'idle' | 'attack' | 'damage' | 'catch' | 'flee' | 'victory'

interface Props {
  imageUrl: string
  name: string
  animState?: AnimState
  size?: number
  /** Element slug — enables element-colored glow on image + aura */
  element?: string
  /** Rarity slug — scales aura intensity */
  rarity?: string
  /** Show atmospheric aura + floor shadow (large display contexts) */
  showAura?: boolean
}

// Vivid accent color per element (used for drop-shadow + aura)
const ELEMENT_GLOW: Record<string, string> = {
  fiamma:    '#FF5520',
  adriatico: '#00C4E8',
  bosco:     '#2ECC6A',
  terra:     '#D4A060',
  armonia:   '#B060F8',
}

// Alpha (0-1) for the aura background — rarer = more intense
const RARITY_ALPHA: Record<string, number> = {
  comune:      0.22,
  non_comune:  0.34,
  raro:        0.48,
  epico:       0.62,
  leggendario: 0.82,
  mitologico:  0.96,
}

const ANIM_VARIANTS: Record<AnimState, TargetAndTransition> = {
  // idle is generated per-size in `idleVariant()` below (amplitude must
  // scale with sprite size or a battle-tuned 8 px bob clips/overpowers
  // a 44–48 px popup / duel-selection thumbnail). This static entry is
  // a safe fallback only.
  idle: {
    y: [0, -6, 0],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
  // Attack: anticipation (pull back + crouch) → snap forward with a
  // scale punch → settle. Kept ≤ the ~260 ms idle-reset window used by
  // the encounter page so the strike fully reads before reverting.
  attack: {
    x: [0, -10, 26, 0],
    scale: [1, 0.94, 1.14, 1],
    transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1], times: [0, 0.28, 0.55, 1] },
  },
  // Damage: sharp recoil shake + a brief white flash AND a red tint so
  // a hit reads instantly even peripherally; small scale dip sells the
  // impact. Brightness eased down from 3 → 2.3 so it punches without
  // strobing.
  damage: {
    x: [0, -9, 9, -6, 0],
    scale: [1, 0.93, 1],
    filter: [
      'brightness(1) saturate(1)',
      'brightness(2.3) saturate(1.6) hue-rotate(-12deg)',
      'brightness(1) saturate(1)',
    ],
    transition: { duration: 0.34, ease: 'easeOut' },
  },
  catch: {
    scale: [1, 0.8, 0.2],
    opacity: [1, 0.8, 0],
    transition: { duration: 0.6, ease: 'easeIn' },
  },
  flee: {
    x: [0, 300],
    opacity: [1, 0],
    transition: { duration: 0.5, ease: 'easeIn' },
  },
  // Victory: a celebratory hop + bounce-scale + wiggle.
  victory: {
    y: [0, -22, 0, -10, 0],
    scale: [1, 1.18, 0.97, 1.06, 1],
    rotate: [0, 9, -9, 5, 0],
    transition: { duration: 0.85, ease: 'easeOut' },
  },
}

function toHex2(n: number) {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
}

// Size-aware organic idle. Bob amplitude tracks the sprite size so the
// same component reads as a gentle breath on a 46 px duel-selection /
// map-popup thumbnail AND a fuller float on a 200 px battle sprite —
// never clipping its container, never looking absurd. Breathing scale
// + micro-sway stay subtle and run on their OWN periods so the loop
// never aligns into a mechanical repeat. Used for the default 'idle'
// state everywhere (battle, bestiary, popups, pre-fight selection).
function idleVariant(size: number): TargetAndTransition {
  const bob = Math.max(2, Math.min(10, size * 0.045))
  return {
    y: [0, -bob, 0],
    scale: [1, 1.03, 1],
    rotate: [-1.2, 1.2, -1.2],
    transition: {
      y:      { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
      scale:  { duration: 3.7, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 5.2, repeat: Infinity, ease: 'easeInOut' },
    },
  }
}

export default function CreatureSprite({
  imageUrl, name, animState = 'idle', size = 200, element, rarity, showAura,
}: Props) {
  const glowColor = element ? (ELEMENT_GLOW[element] ?? '#3A9DBC') : null
  const auraAlpha = rarity ? (RARITY_ALPHA[rarity] ?? 0.25) : 0.25
  // idle is size-aware (see idleVariant); transient states stay fixed.
  const currentVariant = animState === 'idle' ? idleVariant(size) : ANIM_VARIANTS[animState]

  // CSS drop-shadow: element-tinted when element known, generic dark otherwise
  const dropShadow = glowColor
    ? [
        `drop-shadow(0 ${Math.round(size * 0.055)}px ${Math.round(size * 0.12)}px ${glowColor}99)`,
        `drop-shadow(0 0 ${Math.round(size * 0.08)}px ${glowColor}66)`,
      ].join(' ')
    : 'drop-shadow(0 4px 16px rgba(0,0,0,0.75))'

  const spriteNode = imageUrl ? (
    <Image
      src={imageUrl}
      alt={name}
      width={size}
      height={size}
      className="object-contain"
      style={{ filter: dropShadow }}
      priority
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-5xl"
      style={{
        width: size, height: size,
        background: glowColor ? `${glowColor}22` : 'rgba(255,255,255,0.08)',
      }}
    >
      🐾
    </div>
  )

  // ── Aura mode (large battle / bestiary detail) ─────────────────────────────
  if (showAura && glowColor) {
    const auraHex = toHex2(auraAlpha * 255)
    const auraFaint = toHex2(auraAlpha * 0.35 * 255)
    const shadowR = Math.round(size * 0.5)
    const shadowH = Math.max(6, Math.round(size * 0.055))

    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Outer bloom — large blurred circle */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            inset: '-18%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${glowColor}${auraHex} 0%, ${glowColor}${auraFaint} 45%, transparent 70%)`,
            filter: 'blur(14px)',
          }}
          animate={{ opacity: [0.55, 1, 0.55], scale: [0.88, 1.12, 0.88] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Inner crisp ring — sharp glow closest to sprite */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            inset: '8%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${glowColor}${toHex2(auraAlpha * 0.55 * 255)} 0%, transparent 65%)`,
          }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        />

        {/* Floor shadow — ellipse beneath, sync with float */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            bottom: -shadowH,
            left: '50%',
            transform: 'translateX(-50%)',
            width: shadowR,
            height: shadowH,
            borderRadius: '50%',
            background: glowColor,
            filter: `blur(${Math.max(4, Math.round(size * 0.04))}px)`,
            opacity: 0,
          }}
          animate={{
            opacity: [0.22, 0.38, 0.22],
            scaleX: [0.82, 1.18, 0.82],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* The sprite — floats on top of everything */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-10"
          animate={currentVariant}
          key={animState}
        >
          {spriteNode}
        </motion.div>
      </div>
    )
  }

  // ── Default mode — now with a lightweight "stage" so the creature
  //    reads as deliberately placed (grounded portrait) instead of a
  //    flat rectangular asset dropped onto the surface. A soft radial
  //    backlight sits BEHIND the sprite and a contact-shadow ellipse
  //    sits at its feet; both stay ground-fixed (outside the animated
  //    wrapper) so the sprite floats over a stable stage. Subtle and
  //    size-scaled — invisible-but-felt on a 44 px thumbnail, richer at
  //    portrait sizes. Element-tinted when known, neutral otherwise.
  const stageColor = glowColor ?? '#3A9DBC'
  const contactW = Math.round(size * 0.62)
  const contactH = Math.max(4, Math.round(size * 0.07))
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Backlight glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: '6%',
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 46%, ${stageColor}2e 0%, ${stageColor}12 42%, transparent 68%)`,
        }}
      />
      {/* Contact shadow — grounds the creature */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: `${Math.round(size * 0.05)}px`,
          left: '50%',
          width: contactW,
          height: contactH,
          marginLeft: -contactW / 2,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          filter: `blur(${Math.max(2, Math.round(size * 0.03))}px)`,
        }}
      />
      <motion.div
        className="relative flex items-center justify-center w-full h-full"
        animate={currentVariant}
        key={animState}
      >
        {spriteNode}
      </motion.div>
    </div>
  )
}
