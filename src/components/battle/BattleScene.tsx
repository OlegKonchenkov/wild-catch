'use client'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Element, Rarity } from '@/lib/types'
import type { StatusEffect } from '@/lib/game/combat'
import CreatureSprite from '@/components/creature/CreatureSprite'
import ElementBackdrop from './ElementBackdrop'
import StatusAura from './StatusAura'
import VsEmblem from './VsEmblem'

export type BattleAnimState = 'idle' | 'attack' | 'damage' | 'catch' | 'flee' | 'victory'

export interface BattleCombatant {
  element: Element
  /** resolveCreatureSprite(...) — cutout-first, baked-art fallback. */
  spriteUrl: string
  name: string
  rarity: Rarity
  animState?: BattleAnimState
  fainting?: boolean
  statusEffect?: StatusEffect | null
  /** 0..1, drives low-HP darken + danger vignette. */
  hpPct: number
}

interface BattleSceneProps {
  enemy: BattleCombatant
  player: BattleCombatant
  /** Duels: both halves use the neutral arena. */
  arena?: boolean
  /** Crit freeze beat: extra vignette + paused particles. */
  freeze?: boolean
  /** Play the VS lightning strike on mount. */
  vsStruck?: boolean
  /** Boss screens override the gold accent. */
  bossGold?: string
  /**
   * Seam height (% from top). The bottom half hosts the squad + action HUD, so
   * the seam sits ABOVE centre (~44%) to give both creatures balanced visible
   * space. Tune per screen.
   */
  seamPct?: number
  children?: ReactNode
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const ELEMENT_STAGE_GLOW: Record<Element, string> = {
  bosco: '#58E57E',
  fiamma: '#FF6B36',
  adriatico: '#27D8FF',
  terra: '#F2A247',
  armonia: '#D179FF',
}

// z-order: backdrop(0-4) · seam(5) · cards(6) · creatures(8) · VS(9) · HUD(10-12).
// Creatures sit ABOVE the info cards on purpose — they're the focal point, so a
// card never occludes a creature.
function CreatureStage({
  c, maxSize, slideFrom, band, plateScale = 1.18, plateLift = 0,
}: {
  c: BattleCombatant
  maxSize: number
  slideFrom: number
  band: CSSProperties
  plateScale?: number
  plateLift?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(maxSize)
  const glow = ELEMENT_STAGE_GLOW[c.element] ?? '#F0CE7A'
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize(Math.round(Math.max(88, Math.min(width * 0.92, height * 0.96, maxSize))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxSize])

  return (
    <div ref={ref} className="absolute flex items-end" style={band}>
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: '50%',
          bottom: plateLift,
          transform: 'translateX(-50%)',
          width: Math.round(size * plateScale),
          height: Math.max(18, Math.round(size * 0.18)),
          borderRadius: '50%',
          zIndex: 0,
          background: `radial-gradient(ellipse at center, ${glow}62 0%, ${glow}2b 35%, rgba(0,0,0,.3) 58%, transparent 76%)`,
          filter: `blur(${Math.max(6, Math.round(size * 0.045))}px)`,
          opacity: 0.9,
          mixBlendMode: 'screen',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: '50%',
          bottom: plateLift - Math.max(2, Math.round(size * 0.025)),
          transform: 'translateX(-50%)',
          width: Math.round(size * plateScale * 0.92),
          height: Math.max(10, Math.round(size * 0.08)),
          borderRadius: '50%',
          zIndex: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,.56), rgba(0,0,0,.22) 58%, transparent 76%)',
          filter: `blur(${Math.max(5, Math.round(size * 0.035))}px)`,
        }}
      />
      <motion.div
        key={c.name}
        initial={{ x: slideFrom, opacity: 0 }}
        animate={c.fainting
          ? { x: 0, opacity: [1, 0.74, 0.36], y: [0, 12, 38], scale: [1, 0.94, 0.82], rotate: [0, -2.5, -6], filter: 'grayscale(1) brightness(.55) saturate(.45)' }
          : { x: 0, opacity: 1, y: 0, scale: 1, rotate: 0, filter: 'grayscale(0) brightness(1) saturate(1)' }}
        transition={{
          x: { type: 'spring', stiffness: 180, damping: 20, delay: 0.15 },
          opacity: { duration: c.fainting ? 0.72 : 0.5, ease: 'easeOut' },
          default: { duration: c.fainting ? 0.72 : 0.5, ease: 'easeOut' },
        }}
        style={{ display: 'flex', alignItems: 'flex-end', position: 'relative', zIndex: 1, transformOrigin: '50% 100%' }}
      >
        <CreatureSprite
          imageUrl={c.spriteUrl}
          name={c.name}
          size={size}
          element={c.element}
          rarity={c.rarity}
          animState={c.animState ?? 'idle'}
          showAura
        />
        {c.statusEffect && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 20, overflow: 'visible' }}
          >
            <StatusAura status={c.statusEffect} size={size} />
          </div>
        )}
      </motion.div>
      {c.fainting && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: '50%',
            bottom: plateLift - Math.max(4, Math.round(size * 0.02)),
            width: Math.round(size * 0.94),
            height: Math.max(18, Math.round(size * 0.14)),
            marginLeft: -Math.round(size * 0.94) / 2,
            borderRadius: '50%',
            zIndex: 0,
            background: `radial-gradient(ellipse at center, ${glow}66 0%, rgba(255,255,255,.16) 28%, transparent 72%)`,
            filter: `blur(${Math.max(6, Math.round(size * 0.045))}px)`,
            mixBlendMode: 'screen',
          }}
          initial={{ opacity: 0, scale: 0.35 }}
          animate={{ opacity: [0, 0.65, 0], scale: [0.35, 1.28, 1.7] }}
          transition={{ duration: 0.58, ease: 'easeOut' }}
        />
      )}
    </div>
  )
}

function DangerVignette({ top, height, anchor }: { top: string; height: string; anchor: string }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 right-0"
      style={{
        top, height, zIndex: 4,
        background: `radial-gradient(120% 90% at 50% ${anchor}, transparent 38%, rgba(120,10,6,.5) 100%)`,
      }}
      animate={{ opacity: [0.16, 0.34, 0.16] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

/**
 * The immersive battle stage. Two element-themed halves split at `seamPct`,
 * each home to a transparent creature cutout; a fog seam + golden VS emblem fuse
 * them. HUD overlays are passed as children and float on top.
 */
export default function BattleScene({
  enemy, player, arena = false, freeze = false, vsStruck = true, bossGold, seamPct = 46, children,
}: BattleSceneProps) {
  const enemyDim = Math.min(0.32, 0.3 * (1 - clamp01(enemy.hpPct))) + (freeze ? 0.1 : 0)
  const playerDim = Math.min(0.32, 0.3 * (1 - clamp01(player.hpPct))) + (freeze ? 0.1 : 0)

  const enemyBand: CSSProperties = { left: '37%', right: '-9%', top: '8.5%', height: `${seamPct - 10}%`, zIndex: 8, justifyContent: 'center' }
  const playerBand: CSSProperties = { left: '-12%', right: '30%', top: `${seamPct + 3}%`, bottom: '15%', zIndex: 8, justifyContent: 'center' }

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ display: 'flex', flexDirection: 'column', isolation: 'isolate' }}>
      <div className="relative" style={{ height: `${seamPct}%` }}>
        <ElementBackdrop element={arena ? 'arena' : enemy.element} half="top" dim={enemyDim} frozen={freeze} />
      </div>
      <div className="relative" style={{ flex: 1 }}>
        <ElementBackdrop element={arena ? 'arena' : player.element} half="bottom" dim={playerDim} frozen={freeze} />
      </div>

      {/* seam fog */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0"
        style={{
          top: `${seamPct}%`, transform: 'translateY(-50%)', height: 156, zIndex: 5,
          background: 'linear-gradient(180deg,transparent,rgba(4,6,10,.52) 38%,rgba(4,6,10,.7) 50%,rgba(4,6,10,.5) 62%,transparent)',
          backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        }}
      />

      {enemy.hpPct < 0.25 && <DangerVignette top="0" height={`${seamPct}%`} anchor="30%" />}
      {player.hpPct < 0.25 && <DangerVignette top={`${seamPct}%`} height={`${100 - seamPct}%`} anchor="70%" />}

      <CreatureStage c={enemy} maxSize={236} slideFrom={120} band={enemyBand} plateScale={1.15} plateLift={-3} />
      <CreatureStage c={player} maxSize={276} slideFrom={-120} band={playerBand} plateScale={1.22} plateLift={-6} />

      <VsEmblem struck={vsStruck} gold={bossGold} topPct={seamPct} />

      {freeze && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ zIndex: 7, background: 'radial-gradient(120% 80% at 50% 42%, transparent 32%, rgba(0,0,0,.6) 100%)' }}
        />
      )}

      {children}
    </div>
  )
}
