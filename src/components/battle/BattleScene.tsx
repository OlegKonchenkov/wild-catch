'use client'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Element, Rarity } from '@/lib/types'
import CreatureSprite from '@/components/creature/CreatureSprite'
import ElementBackdrop from './ElementBackdrop'
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

// z-order: backdrop(0-4) · seam(5) · cards(6) · creatures(8) · VS(9) · HUD(10-12).
// Creatures sit ABOVE the info cards on purpose — they're the focal point, so a
// card never occludes a creature.
function CreatureStage({
  c, maxSize, slideFrom, band,
}: { c: BattleCombatant; maxSize: number; slideFrom: number; band: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(maxSize)
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
    <div ref={ref} className="absolute flex items-end justify-center" style={band}>
      <motion.div
        initial={{ x: slideFrom, opacity: 0 }}
        animate={c.fainting
          ? { x: 0, opacity: 0.5, y: 20, scale: 0.9, filter: 'grayscale(1) brightness(.55)' }
          : { x: 0, opacity: 1, y: 0, scale: 1, filter: 'grayscale(0) brightness(1)' }}
        transition={{ x: { type: 'spring', stiffness: 180, damping: 20, delay: 0.15 }, opacity: { duration: 0.5 }, default: { duration: 0.5 } }}
        style={{ display: 'flex', alignItems: 'flex-end' }}
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
      </motion.div>
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

  const enemyBand: CSSProperties = { left: '22%', right: 0, top: '8%', height: `${seamPct - 12}%`, zIndex: 8 }
  const playerBand: CSSProperties = { left: 0, right: '22%', top: `${seamPct + 1}%`, bottom: '21%', zIndex: 8 }

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
          top: `${seamPct}%`, transform: 'translateY(-50%)', height: 128, zIndex: 5,
          background: 'linear-gradient(180deg,transparent,rgba(4,6,10,.6) 45%,rgba(4,6,10,.6) 55%,transparent)',
          backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        }}
      />

      {enemy.hpPct < 0.25 && <DangerVignette top="0" height={`${seamPct}%`} anchor="30%" />}
      {player.hpPct < 0.25 && <DangerVignette top={`${seamPct}%`} height={`${100 - seamPct}%`} anchor="70%" />}

      <CreatureStage c={enemy} maxSize={200} slideFrom={120} band={enemyBand} />
      <CreatureStage c={player} maxSize={248} slideFrom={-120} band={playerBand} />

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
