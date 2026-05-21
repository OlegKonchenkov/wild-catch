'use client'
import { type CSSProperties, useEffect, useState } from 'react'
import type { Element, Rarity } from '@/lib/types'
import { RARITY_LABELS, RARITY_COLORS } from '@/lib/types'
import { IconSword } from './icons'

const ELEMENT_EMOJI: Record<Element, string> = {
  bosco: '🌿', fiamma: '🔥', adriatico: '🌊', terra: '⛰', armonia: '🎵',
}
const ELEMENT_GLOW: Record<Element, string> = {
  bosco: '#2ECC6A', fiamma: '#FF5520', adriatico: '#00C4E8', terra: '#D4A060', armonia: '#B060F8',
}

const hpColor = (pct: number) => (pct > 0.5 ? '#34D399' : pct > 0.25 ? '#FBBF24' : '#EF4444')
const numStyle: CSSProperties = { fontWeight: 800, fontVariantNumeric: 'tabular-nums' }

interface Props {
  name: string
  element: Element
  rarity: Rarity
  currentHp: number
  maxHp: number
  atk?: number
  /** Catch-difficulty 1–5 → star row (enemy card). */
  stars?: number
  side: 'enemy' | 'player'
  className?: string
  style?: CSSProperties
}

/**
 * Compact floating info card. Element shown once (leading chip); rarity sits on
 * one row with either difficulty stars (enemy) or ATK (player); HP below. Sized
 * tight so it never crowds the creature, and rendered BELOW the creature in the
 * scene's z-order (the creature wins any overlap).
 */
export default function CombatantCard({
  name, element, rarity, currentHp, maxHp, atk, stars, side, className, style,
}: Props) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0
  const [ghost, setGhost] = useState(pct)
  useEffect(() => {
    const t = setTimeout(() => setGhost(pct), 350)
    return () => clearTimeout(t)
  }, [pct])

  const glow = ELEMENT_GLOW[element]
  const rc = RARITY_COLORS[rarity]
  const clampStars = typeof stars === 'number' ? Math.max(0, Math.min(5, stars)) : null

  return (
    <div
      className={className}
      style={{
        position: 'absolute', zIndex: 6, padding: '10px 12px', borderRadius: 18, minWidth: side === 'player' ? 188 : 176, maxWidth: 230,
        background: 'linear-gradient(155deg,rgba(13,18,28,.62),rgba(6,9,15,.58))',
        border: `1px solid ${glow}55`,
        backdropFilter: 'blur(14px) saturate(1.25)', WebkitBackdropFilter: 'blur(14px) saturate(1.25)',
        boxShadow: `0 12px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.07)`,
        ...style,
      }}
    >
      {/* name row — element chip is the single element indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, background: `${glow}26`, border: `1px solid ${glow}66`, boxShadow: `inset 0 0 9px ${glow}33` }}>
          {ELEMENT_EMOJI[element]}
        </span>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1 }}>{name}</span>
      </div>

      {/* meta row — rarity + (stars | ATK) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 10, padding: '3px 8px', borderRadius: 999, color: rc, background: `${rc}1f`, border: `1px solid ${rc}99`, whiteSpace: 'nowrap' }}>{RARITY_LABELS[rarity]}</span>
        {clampStars !== null && (
          <span style={{ fontSize: 12, letterSpacing: 1.5, color: '#F4D27A', textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
            {'★'.repeat(clampStars)}<span style={{ color: 'rgba(255,255,255,.2)' }}>{'★'.repeat(5 - clampStars)}</span>
          </span>
        )}
        {typeof atk === 'number' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', color: '#FF7A42' }}>
            <IconSword size={14} />
            <span style={{ ...numStyle, fontSize: 15 }}>{atk}</span>
          </span>
        )}
      </div>

      {/* HP */}
      <div style={{ marginTop: 9 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(255,255,255,.5)' }}>HP</span>
          <span style={{ ...numStyle, fontSize: 12.5, color: 'rgba(255,255,255,.92)' }}>
            {Math.max(0, Math.round(currentHp))}<span style={{ color: 'rgba(255,255,255,.45)', fontWeight: 700 }}>/{maxHp}</span>
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.12)', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.4)' }}>
          <span style={{ position: 'absolute', inset: 0, width: `${ghost * 100}%`, borderRadius: 999, background: 'rgba(255,90,70,.5)', transition: 'width .6s ease .15s' }} />
          <span style={{ position: 'relative', display: 'block', height: '100%', width: `${pct * 100}%`, borderRadius: 999, background: `linear-gradient(180deg,${hpColor(pct)},${hpColor(pct)}cc)`, boxShadow: `0 0 8px ${hpColor(pct)}66`, transition: 'width .35s ease, background .35s ease' }} />
        </div>
      </div>
    </div>
  )
}
