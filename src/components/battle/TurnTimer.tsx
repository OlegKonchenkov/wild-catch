'use client'

interface Props {
  /** Seconds left in the current timer window. */
  seconds: number
  /** Full timer budget. */
  total: number
  /** Kept for older callers; the immersive encounter no longer shows turns. */
  turn?: number
  /** Kept for older callers; the immersive encounter no longer shows turn pips. */
  pips?: number
  className?: string
  style?: React.CSSProperties
}

export default function TurnTimer({ seconds, total, className, style }: Props) {
  const safeTotal = Math.max(1, total)
  const pct = Math.max(0, Math.min(1, seconds / safeTotal))
  const urgent = seconds <= 5
  const accent = urgent ? '#EF4444' : '#39E6A5'

  return (
    <div
      className={className}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 92, zIndex: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', ...style }}
    >
      <span style={{ position: 'relative', flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.16)', overflow: 'hidden', boxShadow: '0 0 14px rgba(0,0,0,.45), inset 0 1px 2px rgba(0,0,0,.5)' }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${pct * 100}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${accent}, #F0CE7A)`,
            boxShadow: `0 0 12px ${accent}99`,
            transition: 'width .35s linear, background .2s ease',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: `${pct * 100}%`,
            width: 10,
            height: 10,
            borderRadius: '50%',
            transform: 'translate(-50%,-50%)',
            background: accent,
            border: '2px solid rgba(255,255,255,.72)',
            boxShadow: `0 0 12px ${accent}`,
            transition: 'left .35s linear, background .2s ease',
          }}
        />
      </span>
      <span
        style={{
          minWidth: 30,
          textAlign: 'right',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 10.5,
          fontWeight: 800,
          color: accent,
          textShadow: urgent ? `0 0 10px ${accent}` : undefined,
          animation: urgent ? 'ttPulse .55s ease-in-out infinite' : undefined,
        }}
      >
        {Math.max(0, Math.ceil(seconds))}s
      </span>
      <style>{`@keyframes ttPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
    </div>
  )
}
