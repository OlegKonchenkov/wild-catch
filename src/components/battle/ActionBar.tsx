'use client'
import { type ReactNode } from 'react'

export type ActionTone = 'orange' | 'purple' | 'red' | 'gold' | 'dark'

export interface BattleAction {
  id: string
  label: string
  icon: ReactNode
  /** Hero action — renders wider + larger label, can show a sub line. */
  primary?: boolean
  tone?: ActionTone
  /** Optional second line (e.g. catch chance, turns/5). */
  sub?: string
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
}

const FILL: Record<Exclude<ActionTone, 'dark'>, { bg: string; shadow: string; ring: string; icon: string }> = {
  orange: { bg: 'linear-gradient(150deg,#F16E35 0%,#C94118 100%)', shadow: '0 8px 20px rgba(226,80,28,.34)', ring: 'rgba(255,178,128,.45)', icon: 'rgba(255,238,218,.22)' },
  purple: { bg: 'linear-gradient(150deg,#8051C7 0%,#4E2A8B 100%)', shadow: '0 8px 20px rgba(123,77,184,.32)', ring: 'rgba(195,156,255,.4)', icon: 'rgba(232,216,255,.18)' },
  red: { bg: 'linear-gradient(150deg,#D14530 0%,#8F261A 100%)', shadow: '0 8px 20px rgba(193,58,43,.34)', ring: 'rgba(255,140,120,.36)', icon: 'rgba(255,220,210,.18)' },
  gold: { bg: 'linear-gradient(150deg,#F4CE62 0%,#B98624 100%)', shadow: '0 8px 20px rgba(240,206,122,.32)', ring: 'rgba(255,232,170,.42)', icon: 'rgba(60,37,8,.18)' },
}

function Spinner({ size = 18 }: { size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', display: 'inline-block', animation: 'abSpin .7s linear infinite' }} />
}

/**
 * Hierarchic action bar. One wide primary + compact secondaries; colored tones
 * render as glossy filled buttons, `dark` as glass. Each screen passes its own
 * set (encounter: CATTURA/LOTTA/OGGETTI/FUGGI; boss/duel: ATTACCA + items).
 */
export default function ActionBar({ actions, className }: { actions: BattleAction[]; className?: string }) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 11,
        padding: '10px 13px calc(12px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', gap: 9, alignItems: 'stretch',
        background: 'linear-gradient(180deg,transparent,rgba(3,5,9,.62) 24%,rgba(3,5,9,.94) 100%)',
      }}
    >
      {actions.map((a) => {
        const tone: ActionTone = a.tone ?? (a.primary ? 'orange' : 'dark')
        const disabled = a.disabled || a.loading
        const filled = tone !== 'dark'
        const f = filled ? FILL[tone] : null
        return (
          <button
            key={a.id}
            type="button"
            className="ab-btn"
            disabled={disabled}
            onClick={a.onClick}
            style={{
              flex: a.primary ? 1.12 : 1, minWidth: 0, height: 58,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '7px 6px',
              borderRadius: 16, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
              color: filled ? '#fff' : '#c9d1d9',
              border: filled ? `1px solid ${f!.ring}` : '1px solid rgba(255,255,255,.12)',
              background: filled ? f!.bg : 'linear-gradient(180deg,rgba(21,28,36,.68),rgba(8,12,17,.72))',
              boxShadow: filled
                ? `${f!.shadow}, inset 0 1px 0 rgba(255,255,255,.24), inset 0 -2px 7px rgba(0,0,0,.2)`
                : 'inset 0 1px 0 rgba(255,255,255,.07), 0 6px 16px rgba(0,0,0,.22)',
              backdropFilter: filled ? undefined : 'blur(8px)', WebkitBackdropFilter: filled ? undefined : 'blur(8px)',
              transition: 'transform .1s ease, filter .15s ease, border-color .15s ease',
            }}
          >
            <span
              style={{
                width: 24, height: 24, borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: filled ? f!.icon : 'rgba(255,255,255,.06)',
                filter: filled ? 'drop-shadow(0 1px 1px rgba(0,0,0,.3))' : undefined,
                color: filled ? '#fff' : '#aeb8c2',
              }}
            >
              {a.loading ? <Spinner size={a.primary ? 22 : 20} /> : a.icon}
            </span>
            <span style={{ fontWeight: 900, fontSize: a.primary ? 12.5 : 11, letterSpacing: '.02em', textTransform: 'uppercase', lineHeight: 1, textShadow: filled ? '0 1px 2px rgba(0,0,0,.38)' : undefined }}>
              {a.label}
            </span>
            {a.sub && (
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, fontWeight: 700, opacity: 0.92, marginTop: 1, padding: '1px 7px', borderRadius: 999, background: 'rgba(0,0,0,.22)' }}>{a.sub}</span>
            )}
          </button>
        )
      })}
      <style>{`@keyframes abSpin{to{transform:rotate(360deg)}} .ab-btn:active:not(:disabled){transform:scale(.97)} .ab-btn:hover:not(:disabled){filter:brightness(1.07) saturate(1.04)} .ab-btn:focus-visible{outline:2px solid rgba(255,232,170,.88);outline-offset:3px}`}</style>
    </div>
  )
}
