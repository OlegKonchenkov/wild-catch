'use client'
import Image from 'next/image'
import type { Element } from '@/lib/types'
import ElementIcon from '@/components/ui/ElementIcon'

const ELEMENT_GLOW: Record<Element, string> = {
  bosco: '#48D76F',
  fiamma: '#FF6938',
  adriatico: '#2ED7FF',
  terra: '#E6A35C',
  armonia: '#C472FF',
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
  /** No turn budget left / mid-animation: bench tiles not tappable. */
  switchDisabled?: boolean
  className?: string
  style?: React.CSSProperties
}

export default function SquadBar({ members, onSwitch, switchDisabled, className, style }: Props) {
  return (
    <div
      className={className}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 111, zIndex: 12, display: 'flex', justifyContent: 'center', gap: 6, padding: '0 10px', ...style }}
    >
      {members.map((m) => {
        const pct = m.maxHp > 0 ? Math.max(0, Math.min(1, m.hp / m.maxHp)) : 0
        const tappable = !!onSwitch && !m.active && !m.fainted && !switchDisabled
        const glow = ELEMENT_GLOW[m.element]
        return (
          <button
            key={m.id}
            type="button"
            disabled={!tappable}
            onClick={tappable ? () => onSwitch!(m.id) : undefined}
            aria-label={m.name}
            className="squad-card"
            style={{
              position: 'relative', flex: 1, minWidth: 0, height: 50, display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 6px 5px 5px', borderRadius: 12,
              background: m.active
                ? 'linear-gradient(145deg,rgba(62,42,12,.94),rgba(15,15,12,.82) 58%,rgba(5,8,11,.82))'
                : 'linear-gradient(145deg,rgba(12,18,23,.68),rgba(6,9,13,.64))',
              border: `1px solid ${m.active ? '#FFD66D' : `${glow}42`}`,
              backdropFilter: 'blur(12px) saturate(1.2)', WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
              boxShadow: m.active
                ? '0 0 0 1px rgba(255,214,109,.58), 0 0 22px rgba(255,190,70,.72), 0 0 42px rgba(255,132,30,.22), inset 0 1px 0 rgba(255,255,255,.18), inset 0 0 18px rgba(255,179,54,.2)'
                : `inset 0 1px 0 rgba(255,255,255,.07), 0 5px 14px rgba(0,0,0,.26), 0 0 10px ${glow}16`,
              cursor: tappable ? 'pointer' : 'default',
              opacity: m.fainted ? 0.6 : 1,
              transition: 'transform .12s ease, border-color .2s ease, box-shadow .2s ease, filter .2s ease',
            }}
          >
            {m.active && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 3,
                  borderRadius: 10,
                  border: '1px solid rgba(255,238,174,.56)',
                  boxShadow: 'inset 0 0 12px rgba(255,199,80,.18)',
                  pointerEvents: 'none',
                }}
              />
            )}
            {m.active && (
              <span
                style={{
                  position: 'absolute',
                  top: -10,
                  left: 8,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#3A2307',
                  background: 'linear-gradient(180deg,#FFE08A,#D99021)',
                  border: '1px solid rgba(255,246,196,.82)',
                  boxShadow: '0 0 10px rgba(255,196,70,.9), 0 2px 5px rgba(0,0,0,.55)',
                }}
              >
                {'\u265B'}
              </span>
            )}
            <span
              style={{
                position: 'relative', flexShrink: 0, width: 38, height: 38, borderRadius: 9, overflow: 'hidden',
                background: m.active
                  ? `radial-gradient(circle at 50% 42%, rgba(255,213,100,.36), ${glow}22 52%, rgba(0,0,0,.55) 76%)`
                  : `radial-gradient(circle at 50% 42%, ${glow}36, rgba(0,0,0,.5) 68%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                filter: m.fainted ? 'grayscale(1)' : 'none',
                boxShadow: m.active
                  ? 'inset 0 0 0 1px rgba(255,242,184,.72), 0 0 14px rgba(255,201,74,.65)'
                  : `inset 0 0 0 1px rgba(255,255,255,.08), 0 0 12px ${glow}38`,
              }}
            >
              {m.imageUrl
                ? <Image src={m.imageUrl} alt={m.name} width={38} height={38} style={{ objectFit: 'contain', transform: m.active ? 'scale(1.26)' : 'scale(1.16)' }} />
                : <span style={{ filter: `drop-shadow(0 0 6px ${glow})`, display: 'flex' }}><ElementIcon element={m.element} size={19} /></span>}
              {m.fainted && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#EF4444', fontWeight: 800 }}>{'\u2715'}</span>}
            </span>
            <span style={{ flex: 1, minWidth: 0, height: '100%', display: 'grid', alignContent: 'center', textAlign: 'left' }}>
              <span style={{ display: 'block', fontWeight: 900, fontSize: 9.5, color: m.active ? '#FFF5CB' : '#F7FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: m.active ? '0 0 8px rgba(255,196,70,.42), 0 1px 2px rgba(0,0,0,.8)' : '0 1px 2px rgba(0,0,0,.7)' }}>{m.name}</span>
              <span style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3, fontFamily: 'var(--font-mono, monospace)', fontSize: 7.5, fontWeight: 800, color: 'rgba(255,255,255,.78)' }}>{Math.round(m.hp)}/{m.maxHp}</span>
              <span style={{ display: 'block', height: 4, borderRadius: 999, background: 'rgba(255,255,255,.14)', overflow: 'hidden', marginTop: 2, boxShadow: 'inset 0 1px 2px rgba(0,0,0,.45)' }}>
                <span style={{ display: 'block', height: '100%', width: `${pct * 100}%`, background: `linear-gradient(90deg,${hpColor(pct)},#5CF0B0)`, boxShadow: `0 0 8px ${hpColor(pct)}88`, transition: 'width .35s' }} />
              </span>
            </span>
          </button>
        )
      })}
      <style>{`.squad-card:active:not(:disabled){transform:scale(.98)}.squad-card:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}.squad-card:focus-visible{outline:2px solid rgba(255,232,170,.9);outline-offset:3px}`}</style>
    </div>
  )
}
