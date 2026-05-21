'use client'

interface Props {
  /** Seconds left in the current turn. */
  seconds: number
  /** Full turn budget (kept for API parity / future progress use). */
  total: number
  /** Current turn number (1-based). */
  turn?: number
  /** Number of turn pips to show. */
  pips?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Turn indicator: a pip stepper on the left + "TURNO N" and a mono seconds
 * readout on the right (matches the mockup). Seconds go red + shake under 5s.
 */
export default function TurnTimer({ seconds, total, turn = 1, pips = 6, className, style }: Props) {
  void total
  const urgent = seconds <= 5
  const accent = urgent ? '#EF4444' : '#F0CE7A'

  return (
    <div
      className={className}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 92, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 18px', ...style }}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: 150 }}>
        {Array.from({ length: pips }).map((_, i) => {
          const done = i < turn
          const active = i === turn - 1
          return (
            <div key={i} style={{ display: 'contents' }}>
              <span
                style={{
                  width: active ? 9 : 7, height: active ? 9 : 7, borderRadius: '50%', flexShrink: 0,
                  background: done ? '#34D399' : 'rgba(255,255,255,.18)',
                  boxShadow: active ? '0 0 8px rgba(52,211,153,.8)' : 'none',
                  border: active ? '1px solid rgba(255,255,255,.5)' : 'none',
                }}
              />
              {i < pips - 1 && (
                <span style={{ flex: 1, height: 2, background: i < turn - 1 ? '#34D399' : 'rgba(255,255,255,.14)' }} />
              )}
            </div>
          )
        })}
      </div>

      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono, monospace)', fontSize: 11, fontWeight: 700 }}>
        <span style={{ color: 'rgba(255,255,255,.5)', letterSpacing: '.06em' }}>TURNO {turn}</span>
        <span style={{ color: accent, animation: urgent ? 'ttShake .4s ease-in-out infinite' : undefined }}>⏱ {Math.max(0, Math.ceil(seconds))}s</span>
      </span>
      <style>{`@keyframes ttShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}`}</style>
    </div>
  )
}
