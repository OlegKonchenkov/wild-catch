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
const FILL: Record<Exclude<ActionTone, 'dark'>, { bg: string; glow: string; ring: string; ink: string }> = {
  orange: { bg: 'linear-gradient(160deg,#F9A33B 0%,#E66B20 48%,#A83B0B 100%)', glow: 'rgba(238,118,28,.68)',  ring: 'rgba(255,201,122,.86)', ink: '#FFF5E4' },
  purple: { bg: 'linear-gradient(160deg,#B073F0 0%,#783DCE 50%,#3C1D7E 100%)', glow: 'rgba(164,93,236,.62)', ring: 'rgba(214,167,255,.84)', ink: '#F7EDFF' },
  red:    { bg: 'linear-gradient(160deg,#E8604A 0%,#B23120 100%)',             glow: 'rgba(210,70,50,.55)',  ring: 'rgba(255,150,130,.72)', ink: '#FFF1EE' },
  gold:   { bg: 'linear-gradient(160deg,#F8D26A 0%,#CC8E22 100%)',             glow: 'rgba(240,200,90,.55)', ring: 'rgba(255,228,150,.80)', ink: '#FFF8DA' },
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
        padding: '12px 11px calc(10px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', gap: 8, alignItems: 'stretch',
        background:
          'linear-gradient(180deg, rgba(6,13,25,.12) 0%, rgba(6,13,25,.72) 22%, rgba(6,13,25,.96) 100%), ' +
          'radial-gradient(80% 120% at 50% 100%, rgba(45,128,176,.18), transparent 62%)',
        borderTop: '1px solid rgba(117,190,255,.28)',
        boxShadow: '0 -12px 34px rgba(0,0,0,.38), inset 0 1px 0 rgba(170,225,255,.14)',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 12,
          background:
            'linear-gradient(90deg, transparent, rgba(122,201,255,.55), transparent), ' +
            'linear-gradient(180deg, rgba(78,142,195,.22), transparent)',
          clipPath: 'polygon(0 0, 47% 0, 50% 100%, 53% 0, 100% 0, 100% 18%, 0 18%)',
          pointerEvents: 'none',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute', top: 0, left: '50%', width: 26, height: 26,
          transform: 'translate(-50%, -42%) rotate(45deg)',
          border: '1px solid rgba(145,218,255,.58)',
          background: 'radial-gradient(circle, rgba(153,234,255,.45), rgba(16,39,61,.74) 58%, rgba(3,8,16,.1) 100%)',
          boxShadow: '0 0 18px rgba(80,197,255,.38), inset 0 0 10px rgba(255,255,255,.18)',
          pointerEvents: 'none',
        }}
      />
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
              flex: 1, minWidth: 0, minHeight: 62,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: a.sub ? 3 : 5, padding: '6px 5px', position: 'relative', overflow: 'hidden',
              borderRadius: 15, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.76 : 1,
              color: filled ? f!.ink : '#c6d3df',
              border: filled ? `1.5px solid ${f!.ring}` : '1.2px solid rgba(124,190,215,.34)',
              background: filled
                ? `radial-gradient(120% 82% at 50% -18%, rgba(255,255,255,.36), transparent 56%), radial-gradient(circle at 50% 42%, rgba(255,255,255,.12), transparent 32%), ${f!.bg}`
                : 'radial-gradient(110% 82% at 50% -18%, rgba(156,214,235,.12), transparent 58%), linear-gradient(180deg, rgba(19,35,49,.78), rgba(6,14,25,.9))',
              boxShadow: filled
                ? `0 0 24px ${f!.glow}, 0 10px 22px rgba(0,0,0,.44), inset 0 1px 0 rgba(255,255,255,.44), inset 0 -12px 22px rgba(0,0,0,.26)`
                : '0 8px 20px rgba(0,0,0,.36), inset 0 1px 0 rgba(200,235,255,.10), inset 0 -10px 18px rgba(0,0,0,.20)',
              backdropFilter: filled ? undefined : 'blur(8px)', WebkitBackdropFilter: filled ? undefined : 'blur(8px)',
              transition: 'transform .1s ease, filter .15s ease, border-color .15s ease',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute', inset: 3, borderRadius: 12,
                border: filled ? '1px solid rgba(255,255,255,.18)' : '1px solid rgba(130,200,225,.12)',
                pointerEvents: 'none',
              }}
            />
            {/* soft circular vignette behind the icon (coloured buttons only) */}
            {filled && (
              <span aria-hidden style={{
                position: 'absolute', top: 6, width: 40, height: 40, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,.20) 0%, transparent 68%)', pointerEvents: 'none',
              }} />
            )}
            <span
              style={{
                position: 'relative', zIndex: 1, display: 'flex',
                color: filled ? f!.ink : '#b8cad7',
                filter: filled ? 'drop-shadow(0 2px 6px rgba(0,0,0,.54))' : 'drop-shadow(0 1px 3px rgba(0,0,0,.60))',
              }}
            >
              {a.icon}
            </span>
            <span style={{ position: 'relative', zIndex: 1, fontWeight: 900, fontSize: a.primary ? 11.5 : 10.5, letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1, color: filled ? f!.ink : '#b9c7d4', textShadow: filled ? '0 1px 4px rgba(0,0,0,.56)' : '0 1px 3px rgba(0,0,0,.42)' }}>
              {a.label}
            </span>
            {a.sub && (
              <span style={{
                position: 'relative', zIndex: 1, fontFamily: 'var(--font-mono, monospace)',
                fontSize: 7.5, fontWeight: 700, opacity: 0.95, lineHeight: 1,
                padding: '1px 5px', borderRadius: 999, background: 'rgba(0,0,0,.28)',
                // Stay inside the button — never spill past its rounded edge.
                maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{a.sub}</span>
            )}
          </button>
        )
      })}
      <style>{`.ab-btn svg{width:26px;height:26px}.ab-btn:active:not(:disabled){transform:scale(.97)} .ab-btn:hover:not(:disabled){filter:brightness(1.07) saturate(1.04)} .ab-btn:focus-visible{outline:2px solid rgba(255,232,170,.88);outline-offset:3px}`}</style>
    </div>
  )
}
