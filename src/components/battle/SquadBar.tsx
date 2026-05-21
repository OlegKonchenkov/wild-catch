'use client'
import Image from 'next/image'
import type { Element } from '@/lib/types'

const ELEMENT_EMOJI: Record<Element, string> = {
  bosco: '🌿', fiamma: '🔥', adriatico: '🌊', terra: '⛰', armonia: '🎵',
}
const hpColor = (pct: number) => (pct > 0.5 ? '#34D399' : pct > 0.25 ? '#FBBF24' : '#EF4444')

export interface SquadMember {
  id: string
  name: string
  element: Element
  hp: number
  maxHp: number
  imageUrl?: string
  active?: boolean
  fainted?: boolean
}

interface Props {
  members: SquadMember[]
  onSwitch?: (id: string) => void
  /** No turn budget left / mid-animation → bench tiles not tappable. */
  switchDisabled?: boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * Squad roster as horizontal info-cards (matches the mockup): thumbnail +
 * name + HP bar + current/max. Active slot = gold border + crown; fainted =
 * grayscale + ✕. Tapping a healthy bench card calls onSwitch (the screen owns
 * the confirm + eligibility rules).
 */
export default function SquadBar({ members, onSwitch, switchDisabled, className, style }: Props) {
  return (
    <div
      className={className}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 116, zIndex: 10, display: 'flex', justifyContent: 'center', gap: 8, padding: '0 12px', ...style }}
    >
      {members.map((m) => {
        const pct = m.maxHp > 0 ? Math.max(0, Math.min(1, m.hp / m.maxHp)) : 0
        const tappable = !!onSwitch && !m.active && !m.fainted && !switchDisabled
        return (
          <button
            key={m.id}
            type="button"
            disabled={!tappable}
            onClick={tappable ? () => onSwitch!(m.id) : undefined}
            aria-label={m.name}
            style={{
              position: 'relative', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 8px 6px 6px', borderRadius: 14,
              background: m.active ? 'rgba(20,17,8,.72)' : 'rgba(10,13,18,.62)',
              border: `1px solid ${m.active ? '#F0CE7A' : 'rgba(255,255,255,.12)'}`,
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              boxShadow: m.active ? '0 0 16px rgba(240,206,122,.4), inset 0 1px 0 rgba(255,255,255,.08)' : 'inset 0 1px 0 rgba(255,255,255,.05)',
              cursor: tappable ? 'pointer' : 'default',
              opacity: m.fainted ? 0.6 : 1,
              transition: 'border-color .2s, box-shadow .2s',
            }}
          >
            {m.active && (
              <span style={{ position: 'absolute', top: -9, left: 8, fontSize: 13, color: '#F0CE7A', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>♛</span>
            )}
            <span style={{ position: 'relative', flexShrink: 0, width: 38, height: 38, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: m.fainted ? 'grayscale(1)' : 'none' }}>
              {m.imageUrl
                ? <Image src={m.imageUrl} alt={m.name} width={38} height={38} style={{ objectFit: 'cover' }} />
                : <span style={{ fontSize: 20 }}>{ELEMENT_EMOJI[m.element]}</span>}
              {m.fainted && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#EF4444', fontWeight: 800 }}>✕</span>}
            </span>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 11.5, color: '#ECEFF1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
              <span style={{ display: 'block', height: 5, borderRadius: 999, background: 'rgba(255,255,255,.13)', overflow: 'hidden', margin: '3px 0 2px' }}>
                <span style={{ display: 'block', height: '100%', width: `${pct * 100}%`, background: hpColor(pct), transition: 'width .35s' }} />
              </span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,.6)' }}>{Math.round(m.hp)}/{m.maxHp}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
