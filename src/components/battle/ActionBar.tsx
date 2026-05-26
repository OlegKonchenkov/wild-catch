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

// Vivid full-fill tones with a coloured outer glow — replicates the reference
// mockup (bright amber CATTURA, rich purple LOTTA) where the whole button
// glows in its hue. `ring` is the lighter rim; `glow` is the bleed halo.
const FILL: Record<Exclude<ActionTone, 'dark'>, { bg: string; glow: string; ring: string }> = {
  orange: { bg: 'linear-gradient(165deg,#F7A23C 0%,#E86A22 52%,#C5440F 100%)', glow: 'rgba(232,110,30,.6)',  ring: 'rgba(255,196,130,.75)' },
  purple: { bg: 'linear-gradient(165deg,#A06FE3 0%,#7140C6 52%,#4A2390 100%)', glow: 'rgba(150,95,224,.55)', ring: 'rgba(199,160,255,.75)' },
  red:    { bg: 'linear-gradient(165deg,#E8604A 0%,#B23120 100%)',             glow: 'rgba(210,70,50,.55)',  ring: 'rgba(255,150,130,.7)'  },
  gold:   { bg: 'linear-gradient(165deg,#F8D26A 0%,#CC8E22 100%)',             glow: 'rgba(240,200,90,.55)', ring: 'rgba(255,228,150,.78)' },
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
              flex: 1, minWidth: 0, minHeight: 82,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: a.sub ? 5 : 7, padding: '8px 6px', position: 'relative', overflow: 'hidden',
              borderRadius: 20, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
              color: filled ? '#fff' : '#c4ccd6',
              border: filled ? `1.5px solid ${f!.ring}` : '1px solid rgba(255,255,255,.1)',
              background: filled
                ? `radial-gradient(125% 80% at 50% -12%, rgba(255,255,255,.32), transparent 56%), ${f!.bg}`
                : 'radial-gradient(125% 80% at 50% -12%, rgba(255,255,255,.06), transparent 60%), linear-gradient(180deg, rgba(20,30,44,.74), rgba(9,15,24,.82))',
              boxShadow: filled
                ? `0 0 22px ${f!.glow}, 0 8px 22px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.4), inset 0 -10px 20px rgba(0,0,0,.22)`
                : 'inset 0 1px 0 rgba(255,255,255,.06), 0 6px 16px rgba(0,0,0,.32)',
              backdropFilter: filled ? undefined : 'blur(8px)', WebkitBackdropFilter: filled ? undefined : 'blur(8px)',
              transition: 'transform .1s ease, filter .15s ease, border-color .15s ease',
            }}
          >
            {/* soft circular vignette behind the icon (coloured buttons only) */}
            {filled && (
              <span aria-hidden style={{
                position: 'absolute', top: 9, width: 50, height: 50, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,.18) 0%, transparent 68%)', pointerEvents: 'none',
              }} />
            )}
            <span
              style={{
                position: 'relative', zIndex: 1, display: 'flex',
                color: filled ? '#fff' : '#cdd5df',
                filter: filled ? 'drop-shadow(0 2px 5px rgba(0,0,0,.5))' : 'drop-shadow(0 1px 2px rgba(0,0,0,.55))',
              }}
            >
              {a.loading ? <Spinner size={a.primary ? 26 : 24} /> : a.icon}
            </span>
            <span style={{ position: 'relative', zIndex: 1, fontWeight: 800, fontSize: a.primary ? 13 : 12, letterSpacing: '.07em', textTransform: 'uppercase', lineHeight: 1, color: filled ? '#fff' : '#aeb8c2', textShadow: filled ? '0 1px 3px rgba(0,0,0,.5)' : undefined }}>
              {a.label}
            </span>
            {a.sub && (
              <span style={{
                position: 'relative', zIndex: 1, fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8.5, fontWeight: 700, opacity: 0.95, lineHeight: 1.1,
                padding: '1px 6px', borderRadius: 999, background: 'rgba(0,0,0,.28)',
                // Stay inside the button — never spill past its rounded edge.
                maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{a.sub}</span>
            )}
          </button>
        )
      })}
      <style>{`@keyframes abSpin{to{transform:rotate(360deg)}} .ab-btn:active:not(:disabled){transform:scale(.97)} .ab-btn:hover:not(:disabled){filter:brightness(1.07) saturate(1.04)} .ab-btn:focus-visible{outline:2px solid rgba(255,232,170,.88);outline-offset:3px}`}</style>
    </div>
  )
}
