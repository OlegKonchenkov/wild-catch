'use client'
import { motion } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { ELEMENT_EMOJI, RARITY_COLORS, RARITY_LABELS } from '@/lib/types'
import type { Element, Rarity } from '@/lib/types'
import { STATUS_EFFECT_META } from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'

export interface CreatureCardProps {
  imageUrl: string
  name: string
  element: string
  rarity: string
  currentHp: number
  maxHp: number
  atk?: number
  animState?: 'idle' | 'attack' | 'damage'
  fainting?: boolean
  side: 'left' | 'right'
  lineup?: Array<{ color: string; isActive: boolean; fainted: boolean }>
  lineupLabel?: string
  isBoss?: boolean
  statusEffect?: StatusEffect | null
  statusTurnsLeft?: number
}

export default function CreatureCard({
  imageUrl,
  name,
  element,
  rarity,
  currentHp,
  maxHp,
  atk,
  animState = 'idle',
  side,
  lineup,
  lineupLabel,
  isBoss,
  fainting,
  statusEffect,
  statusTurnsLeft,
}: CreatureCardProps) {
  const spriteSize = typeof window !== 'undefined'
    ? Math.round(Math.min(window.innerWidth * 0.35, window.innerHeight * 0.2, 158))
    : 122
  const imageWidth = spriteSize + 10
  const rarityColor = isBoss ? '#F7C841' : (RARITY_COLORS[rarity as Rarity] ?? '#64748b')
  const elemEmoji = ELEMENT_EMOJI[element as keyof typeof ELEMENT_EMOJI] ?? '✦'
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
  const hpColor = hpPct > 50 ? '#34D399' : hpPct > 25 ? '#FBBF24' : '#EF4444'

  const borderRadius = side === 'right' ? '16px 0 0 16px' : '0 16px 16px 0'

  return (
    <div
      className="flex overflow-hidden relative"
      style={{
        borderRadius,
        background: 'rgba(4,8,18,0.92)',
        border: `1px solid ${rarityColor}45`,
        borderRight: side === 'right' ? 'none' : `1px solid ${rarityColor}45`,
        borderLeft:  side === 'left'  ? 'none' : `1px solid ${rarityColor}45`,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 16px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px ${rarityColor}18`,
        filter: fainting ? 'grayscale(1)' : undefined,
        transition: 'filter 0.3s ease',
      }}
    >
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{
          width: imageWidth,
          background: `linear-gradient(135deg, ${rarityColor}18 0%, transparent 70%)`,
        }}
      >
        <CreatureSprite
          imageUrl={imageUrl}
          name={name}
          animState={animState}
          size={spriteSize}
          element={element as Element}
          rarity={rarity as Rarity}
          showAura
        />
        {isBoss && (
          <div
            className="absolute top-1.5 left-1.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              background: 'rgba(247,200,65,0.2)',
              border: '1px solid rgba(247,200,65,0.5)',
              color: '#F7C841',
            }}
          >
            BOSS
          </div>
        )}
      </div>

      <div className="flex-1 px-3 py-2.5 flex flex-col justify-between min-w-0">
        <div>
          <p className="font-extrabold text-white text-[13px] leading-tight truncate mb-1.5">
            {name}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isBoss ? (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(247,200,65,0.15)',
                  border: '1px solid rgba(247,200,65,0.4)',
                  color: '#F7C841',
                }}
              >
                Capo Palestra
              </span>
            ) : (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: `${rarityColor}22`,
                  border: `1px solid ${rarityColor}55`,
                  color: rarityColor,
                }}
              >
                {RARITY_LABELS[rarity as Rarity]}
              </span>
            )}
            <span className="text-[11px] leading-none">{elemEmoji}</span>
            <span className="text-[9px] text-white/35 capitalize">{element}</span>
          </div>
          {statusEffect && STATUS_EFFECT_META[statusEffect] && (() => {
            const meta = STATUS_EFFECT_META[statusEffect]
            return (
              <div className="mt-1.5">
                <motion.span
                  className="text-[10px] font-extrabold px-2 py-1 rounded-lg flex items-center gap-1 w-fit"
                  animate={{ opacity: [1, 0.65, 1], scale: [1, 0.96, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    background: `${meta.color}22`,
                    border: `1px solid ${meta.color}70`,
                    color: meta.color,
                    boxShadow: `0 0 10px ${meta.glow}, 0 0 20px ${meta.color}18, inset 0 0 6px ${meta.color}10`,
                  }}
                >
                  <span className="text-[11px] leading-none">{meta.emoji}</span>
                  <span>{meta.label}</span>
                  {statusTurnsLeft != null && statusTurnsLeft > 0 && (
                    <span className="opacity-50 text-[9px] font-bold ml-0.5">×{statusTurnsLeft}</span>
                  )}
                </motion.span>
              </div>
            )
          })()}
        </div>

        {lineup && lineup.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            {lineupLabel && (
              <span className="text-[8px] text-white/25 uppercase tracking-wider">{lineupLabel}</span>
            )}
            <div className="flex gap-1">
              {lineup.map((dot, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: dot.fainted ? 'rgba(255,255,255,0.1)' : dot.color,
                    opacity:    dot.fainted ? 0.3 : dot.isActive ? 1 : 0.55,
                    boxShadow:  dot.isActive ? `0 0 4px ${dot.color}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {atk !== undefined && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider">ATK</span>
            <span className="text-[11px] font-extrabold" style={{ color: isBoss ? '#F7C841' : '#E85D2F' }}>{atk}</span>
          </div>
        )}

        <div className="mt-1.5">
          <div className="h-[7px] rounded-full overflow-hidden mb-[3px]" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${hpPct}%` }}
              transition={{ duration: 0.5 }}
              style={{ background: hpColor, boxShadow: `0 0 6px ${hpColor}90` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-bold uppercase tracking-wider text-white/25">HP</span>
            <span className="text-[9px] font-mono font-bold text-white/50">{currentHp}/{maxHp}</span>
          </div>
        </div>
      </div>

      {fainting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <span className="text-4xl">💀</span>
        </motion.div>
      )}
    </div>
  )
}
