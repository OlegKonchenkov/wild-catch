'use client'

import { type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Element, Rarity } from '@/lib/types'
import type { StatusEffect } from '@/lib/game/combat'
import type { AttackAnimationProps } from '@/components/battle/animations/types'
import { resolveCreatureSprite } from '@/lib/game/battle-scene'
import BattleScene, { type BattleAnimState } from './BattleScene'
import CombatantCard from './CombatantCard'
import DamageBurst, { type BurstKind } from './DamageBurst'
import SquadBar, { type SquadMember } from './SquadBar'
import TurnTimer from './TurnTimer'
import ActionBar, { type BattleAction } from './ActionBar'
import AttackAnimation from './AttackAnimation'

export interface ImmersiveCombatant {
  name: string
  element: Element
  rarity: Rarity
  currentHp: number
  maxHp: number
  imageUrl?: string | null
  spriteUrl?: string | null
  spriteCutoutUrl?: string | null
  atk?: number
  stars?: number
  animState?: BattleAnimState
  fainting?: boolean
  statusEffect?: StatusEffect | null
  statusTurnsLeft?: number | null
}

export interface ImmersiveDamage {
  id: string | number
  amount: number
  target: 'enemy' | 'player'
  kind?: BurstKind
  label?: string
}

export interface ImmersiveNotice {
  id?: string | number
  text: ReactNode
  color?: string
  glow?: string
  critical?: boolean
}

interface Props {
  enemy: ImmersiveCombatant
  player: ImmersiveCombatant
  arena?: boolean
  freeze?: boolean
  bossGold?: string
  seamPct?: number
  notice?: ImmersiveNotice | null
  damage?: ImmersiveDamage | null
  attackAnimation?: (AttackAnimationProps & { key: string | number }) | null
  onAttackAnimationComplete?: () => void
  squad?: SquadMember[]
  onSwitch?: (id: string) => void
  switchDisabled?: boolean
  timerSeconds?: number
  timerTotal?: number
  actions?: BattleAction[]
  enemyCardStyle?: CSSProperties
  playerCardStyle?: CSSProperties
  children?: ReactNode
}

const clampPct = (hp: number, maxHp: number) => {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 0
  return Math.max(0, Math.min(1, hp / maxHp))
}

const spriteFor = (c: ImmersiveCombatant) => resolveCreatureSprite({
  sprite_cutout_url: c.spriteCutoutUrl,
  sprite_url: c.spriteUrl,
  image_url: c.imageUrl,
})

function CenterNotice({ notice, seamPct = 44 }: { notice?: ImmersiveNotice | null; seamPct?: number }) {
  if (!notice) return null
  const color = notice.color ?? (notice.critical ? '#FB923C' : '#F0CE7A')
  const glow = notice.glow ?? (notice.critical ? 'rgba(249,115,22,.42)' : 'rgba(240,206,122,.28)')

  return (
    <div className="pointer-events-none absolute inset-x-0 flex justify-center px-4" style={{ top: `calc(${seamPct}% - 54px)`, zIndex: 13 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={notice.id ?? String(notice.text)}
          initial={{ opacity: 0, scale: notice.critical ? 1.18 : 0.88, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -4 }}
          transition={{ duration: 0.18 }}
          style={{
            maxWidth: 270,
            borderRadius: 999,
            padding: '7px 12px',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 900,
            lineHeight: 1.15,
            color,
            background: 'rgba(6,9,14,.64)',
            border: `1px solid ${color}66`,
            boxShadow: `0 0 18px ${glow}, inset 0 1px 0 rgba(255,255,255,.08)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          {notice.text}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function ImpactFlash({ damage, seamPct }: { damage: ImmersiveDamage; seamPct: number }) {
  const isCrit = damage.kind === 'crit'
  const isHeal = damage.kind === 'heal'
  const color = isHeal ? '#34D399' : isCrit ? '#F7C841' : damage.kind === 'poison' ? '#4ADE80' : '#EF4444'
  const origin = damage.target === 'enemy' ? `72% ${Math.max(16, seamPct - 26)}%` : `28% ${Math.min(84, seamPct + 26)}%`

  return (
    <motion.div
      key={`impact-${damage.id}`}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        zIndex: 18,
        background: `radial-gradient(circle at ${origin}, ${color}${isCrit ? '88' : '66'} 0%, ${color}22 18%, transparent 42%)`,
        mixBlendMode: isCrit ? 'screen' : 'plus-lighter',
      }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: [0, isCrit ? 0.7 : 0.38, 0], scale: [0.98, isCrit ? 1.035 : 1.015, 1] }}
      transition={{ duration: isCrit ? 0.32 : 0.22, ease: 'easeOut' }}
    />
  )
}

export default function ImmersiveBattleLayout({
  enemy,
  player,
  arena,
  freeze,
  bossGold,
  seamPct = 44,
  notice,
  damage,
  attackAnimation,
  onAttackAnimationComplete,
  squad,
  onSwitch,
  switchDisabled,
  timerSeconds,
  timerTotal,
  actions,
  enemyCardStyle,
  playerCardStyle,
  children,
}: Props) {
  const enemyHpPct = clampPct(enemy.currentHp, enemy.maxHp)
  const playerHpPct = clampPct(player.currentHp, player.maxHp)
  const sceneFreeze = freeze || damage?.kind === 'crit'

  return (
    <div
      className="relative h-full overflow-hidden select-none"
      style={{ background: '#030610', zIndex: 1, ['--font-mono' as string]: 'var(--font-geist-mono)' } as CSSProperties}
    >
      <BattleScene
        enemy={{ element: enemy.element, spriteUrl: spriteFor(enemy), name: enemy.name, rarity: enemy.rarity, animState: enemy.animState, fainting: enemy.fainting, statusEffect: enemy.statusEffect, hpPct: enemyHpPct }}
        player={{ element: player.element, spriteUrl: spriteFor(player), name: player.name, rarity: player.rarity, animState: player.animState, fainting: player.fainting, statusEffect: player.statusEffect, hpPct: playerHpPct }}
        arena={arena}
        freeze={sceneFreeze}
        bossGold={bossGold}
        seamPct={seamPct}
      >
        <CombatantCard
          side="enemy"
          name={enemy.name}
          element={enemy.element}
          rarity={enemy.rarity}
          currentHp={enemy.currentHp}
          maxHp={enemy.maxHp}
          stars={enemy.stars}
          statusEffect={enemy.statusEffect}
          statusTurnsLeft={enemy.statusTurnsLeft}
          style={{ top: 12, left: 10, ...enemyCardStyle }}
        />
        <CombatantCard
          side="player"
          name={player.name}
          element={player.element}
          rarity={player.rarity}
          currentHp={player.currentHp}
          maxHp={player.maxHp}
          atk={player.atk}
          statusEffect={player.statusEffect}
          statusTurnsLeft={player.statusTurnsLeft}
          style={{ top: `calc(${seamPct}% + 38px)`, right: 10, ...playerCardStyle }}
        />

        <CenterNotice notice={notice} seamPct={seamPct} />

        {damage && <ImpactFlash damage={damage} seamPct={seamPct} />}

        {damage && (
          <DamageBurst
            key={damage.id}
            amount={damage.amount}
            kind={damage.kind}
            target={damage.target}
            label={damage.label}
          />
        )}

        {attackAnimation && (
          <AttackAnimation
            key={attackAnimation.key}
            element={attackAnimation.element}
            rarity={attackAnimation.rarity}
            side={attackAnimation.side}
            soundUrl={attackAnimation.soundUrl}
            soundDurationMs={attackAnimation.soundDurationMs}
            onComplete={onAttackAnimationComplete}
          />
        )}

        {squad && squad.length >= 2 && (
          <SquadBar members={squad} onSwitch={onSwitch} switchDisabled={switchDisabled} />
        )}
        {typeof timerSeconds === 'number' && typeof timerTotal === 'number' && (
          <TurnTimer seconds={timerSeconds} total={timerTotal} />
        )}
        {actions && actions.length > 0 && <ActionBar actions={actions} />}

        {children}
      </BattleScene>
    </div>
  )
}
