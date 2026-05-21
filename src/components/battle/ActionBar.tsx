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

const FILL: Record<Exclude<ActionTone, 'dark'>, { bg: string; shadow: string; ring: string }> = {
  orange: { bg: 'linear-gradient(135deg,#F0703B 0%,#D24A1C 100%)', shadow: '0 8px 22px rgba(226,80,28,.5)', ring: 'rgba(255,170,120,.35)' },
  purple: { bg: 'linear-gradient(135deg,#8A57C9 0%,#5E37A0 100%)', shadow: '0 8px 22px rgba(123,77,184,.45)', ring: 'rgba(190,150,240,.32)' },
  red: { bg: 'linear-gradient(135deg,#D14530 0%,#9A2C1C 100%)', shadow: '0 8px 22px rgba(193,58,43,.5)', ring: 'rgba(255,140,120,.32)' },
  gold: { bg: 'linear-gradient(135deg,#F4CE62 0%,#C99A2E 100%)', shadow: '0 8px 22px rgba(240,206,122,.45)', ring: 'rgba(255,232,170,.4)' },
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
        padding: '11px 12px calc(12px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', gap: 8, alignItems: 'stretch',
        background: 'linear-gradient(180deg,transparent,rgba(3,5,9,.7) 30%,rgba(3,5,9,.95) 100%)',
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
              flex: a.primary ? 1.3 : 1, minWidth: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: a.primary ? 2 : 3, padding: a.primary ? '9px 10px' : '10px 5px',
              borderRadius: 15, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
              color: filled ? '#fff' : '#c9d1d9',
              border: filled ? `1px solid ${f!.ring}` : '1px solid rgba(255,255,255,.10)',
              background: filled ? f!.bg : 'linear-gradient(180deg,rgba(20,26,34,.72),rgba(12,16,22,.72))',
              boxShadow: filled
                ? `${f!.shadow}, inset 0 1px 0 rgba(255,255,255,.28), inset 0 -2px 6px rgba(0,0,0,.18)`
                : 'inset 0 1px 0 rgba(255,255,255,.06)',
              backdropFilter: filled ? undefined : 'blur(8px)', WebkitBackdropFilter: filled ? undefined : 'blur(8px)',
              transition: 'transform .1s ease, filter .15s ease',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', filter: filled ? 'drop-shadow(0 1px 1px rgba(0,0,0,.3))' : undefined, color: filled ? '#fff' : (tone === 'dark' ? '#aeb8c2' : undefined) }}>
              {a.loading ? <Spinner size={a.primary ? 22 : 20} /> : a.icon}
            </span>
            <span style={{ fontWeight: 800, fontSize: a.primary ? 13.5 : 11.5, letterSpacing: '.02em', textTransform: 'uppercase', lineHeight: 1 }}>
              {a.label}
            </span>
            {a.sub && (
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, fontWeight: 700, opacity: 0.92, marginTop: 1, padding: '1px 7px', borderRadius: 999, background: 'rgba(0,0,0,.22)' }}>{a.sub}</span>
            )}
          </button>
        )
      })}
      <style>{`@keyframes abSpin{to{transform:rotate(360deg)}} .ab-btn:active:not(:disabled){transform:scale(.96)} .ab-btn:hover:not(:disabled){filter:brightness(1.06)}`}</style>
    </div>
  )
}
