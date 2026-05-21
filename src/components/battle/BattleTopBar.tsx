'use client'
import { IconCrest, IconCoin, IconClock, IconBell } from './icons'

interface Props {
  level: number
  /** 0..1 XP progress toward next level. */
  xpPct?: number
  gold: number
  /** Session countdown label, e.g. "43h 48m". */
  sessionLabel?: string
  notifications?: number
  className?: string
}

const num: React.CSSProperties = { fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '.01em' }

/**
 * Diegetic top bar matching the mockup: gold level crest + XP, gold coin count,
 * red session clock, bell. Chunky tabular numerals (no jitter). Floats over the
 * scene. Wire to GameShell data on real screens; props otherwise.
 */
export default function BattleTopBar({ level, xpPct = 0, gold, sessionLabel, notifications = 0, className }: Props) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '12px 16px 16px',
        background: 'linear-gradient(180deg,rgba(4,6,10,.72) 0%,rgba(4,6,10,.35) 70%,transparent 100%)',
      }}
    >
      {/* level + xp */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.5))' }}><IconCrest size={32} /></span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ ...num, fontSize: 15, color: '#fff' }}>Lv <span style={{ color: '#F4D27A' }}>{level}</span></span>
          <span style={{ width: 64, height: 5, borderRadius: 999, background: 'rgba(255,255,255,.16)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(1, xpPct)) * 100}%`, background: 'linear-gradient(90deg,#F4D27A,#C99A2E)', boxShadow: '0 0 6px rgba(240,206,122,.6)' }} />
          </span>
        </span>
      </span>

      {/* gold */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconCoin size={21} />
        <span style={{ ...num, fontSize: 15, color: '#F4E3B0' }}>{gold.toLocaleString('it-IT')}</span>
      </span>

      {/* session timer */}
      {sessionLabel && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconClock size={20} />
          <span style={{ ...num, fontSize: 15, color: '#FF8A6E' }}>{sessionLabel}</span>
        </span>
      )}

      {/* bell */}
      <span style={{ position: 'relative', display: 'flex', color: 'rgba(255,255,255,.78)' }}>
        <IconBell size={21} />
        {notifications > 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: '#FF4D4D', border: '1.5px solid #06070a', boxShadow: '0 0 6px rgba(255,77,77,.8)' }} />
        )}
      </span>
    </div>
  )
}
