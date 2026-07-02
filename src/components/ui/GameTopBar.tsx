'use client'
import { motion } from 'framer-motion'
import CountUp from '@/components/game/CountUp'

/**
 * Premium "real game" status bar prototype: a gilded crown-shield level badge,
 * a glossy coin pill and a gem-like timer pill, with a polished bell. Rich,
 * dimensional, colourful — driven entirely by props (no game logic here).
 */
const CINZEL = 'var(--font-cinzel), Georgia, "Times New Roman", serif'

function LevelShield({ level, loading }: { level: number; loading: boolean }) {
  return (
    <motion.svg
      width={38} height={44} viewBox="0 0 48 56" aria-hidden className="shrink-0"
      initial={false}
      animate={{ filter: ['drop-shadow(0 0 5px rgba(247,200,65,0.35))', 'drop-shadow(0 0 11px rgba(247,200,65,0.6))', 'drop-shadow(0 0 5px rgba(247,200,65,0.35))'] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        <linearGradient id="wcShGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFEEA8" />
          <stop offset="0.5" stopColor="#F3C233" />
          <stop offset="1" stopColor="#A9741A" />
        </linearGradient>
        <linearGradient id="wcShFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b4763" />
          <stop offset="1" stopColor="#0a2032" />
        </linearGradient>
        <linearGradient id="wcShGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* crown */}
      <path d="M13 13.5 L13 6 L18.5 9.6 L24 3.4 L29.5 9.6 L35 6 L35 13.5 Z"
        fill="url(#wcShGold)" stroke="#7d5410" strokeWidth="0.8" strokeLinejoin="round" />
      <circle cx="13" cy="6" r="1.5" fill="#FF6B6B" stroke="#7d5410" strokeWidth="0.5" />
      <circle cx="24" cy="3.4" r="1.7" fill="#5BD6F0" stroke="#7d5410" strokeWidth="0.5" />
      <circle cx="35" cy="6" r="1.5" fill="#FF6B6B" stroke="#7d5410" strokeWidth="0.5" />

      {/* shield border (gold) */}
      <path d="M24 53 C15 50 8 44 8 34 V18 C8 15.8 9.4 14.4 11.5 14.4 H36.5 C38.6 14.4 40 15.8 40 18 V34 C40 44 33 50 24 53 Z"
        fill="url(#wcShGold)" stroke="#7d5410" strokeWidth="0.9" strokeLinejoin="round" />
      {/* inner face */}
      <path d="M24 49.4 C16.6 47 11.4 42 11.4 33.4 V19.4 C11.4 18.1 12.2 17.4 13.4 17.4 H34.6 C35.8 17.4 36.6 18.1 36.6 19.4 V33.4 C36.6 42 31.4 47 24 49.4 Z"
        fill="url(#wcShFace)" />
      {/* gloss on top half */}
      <path d="M24 49.4 C16.6 47 11.4 42 11.4 33.4 V19.4 C11.4 18.1 12.2 17.4 13.4 17.4 H34.6 C35.8 17.4 36.6 18.1 36.6 19.4 V31 C30 27.5 18 27.5 11.4 31 Z"
        fill="url(#wcShGloss)" opacity="0.5" />
      {/* level number */}
      <text x="24" y="38.5" textAnchor="middle" style={{ fontFamily: CINZEL, fontWeight: 700 }}
        fontSize="17" fill="#FFE9A6" stroke="#5a3d08" strokeWidth="0.5">
        {loading ? '·' : level}
      </text>
    </motion.svg>
  )
}

function Coin() {
  return (
    <svg width={19} height={19} viewBox="0 0 20 20" aria-hidden className="shrink-0">
      <defs>
        <radialGradient id="wcCoinFace" cx="42%" cy="34%" r="72%">
          <stop offset="0" stopColor="#FFF3C2" />
          <stop offset="0.55" stopColor="#F4C53A" />
          <stop offset="1" stopColor="#C68A1A" />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="9" fill="#8a6212" />
      <circle cx="10" cy="10" r="8" fill="url(#wcCoinFace)" />
      <circle cx="10" cy="10" r="5.4" fill="none" stroke="#B5841E" strokeWidth="0.9" opacity="0.7" />
      <path d="M10 6 L11 8.4 L13.6 8.7 L11.6 10.5 L12.2 13.1 L10 11.7 L7.8 13.1 L8.4 10.5 L6.4 8.7 L9 8.4 Z" fill="#FFF6D6" />
      <path d="M6 6.5 A6 6 0 0 1 13 5.4" fill="none" stroke="#FFFBEB" strokeWidth="1.3" strokeLinecap="round" opacity="0.65" />
    </svg>
  )
}

function Hourglass({ color }: { color: string }) {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3c0 4 4 5.5 5 9 1-3.5 5-5 5-9M7 21c0-4 4-5.5 5-9 1 3.5 5 5 5 9" fill={color} fillOpacity="0.18" />
    </svg>
  )
}

function Gem() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.55))' }}>
      <path d="M6 3h12l4 6-10 12L2 9z" fill="#4FD1C5" fillOpacity="0.9" />
      <path d="M6 3h12l4 6H2z" fill="#7EE8DE" fillOpacity="0.95" />
      <path d="M2 9h20l-10 12z" fill="#2FB3A8" />
      <path d="M9 3l3 6 3-6M2 9h20" stroke="#0b2b28" strokeOpacity="0.35" strokeWidth="0.7" fill="none" />
    </svg>
  )
}

export default function GameTopBar({
  level, xpPct, gold, gemme, timerFormatted, timerCritical, timerWarning, statsLoading, unreadCount, onBell,
}: {
  level: number | null
  xpPct: number
  gold: number | null
  gemme?: number | null
  timerFormatted: string
  timerCritical: boolean
  timerWarning: boolean
  statsLoading: boolean
  unreadCount: number
  onBell: () => void
}) {
  const timerColor = timerCritical ? '#FF8A98' : timerWarning ? '#FBBF24' : '#FF9663'

  return (
    <header
      className="relative flex items-center justify-between gap-2 px-3.5 py-1.5 z-10"
      style={{
        // "Gilded Relic": ornate dark plate, gold rims top & bottom, embossed
        // depth, gem dividers between clusters. No heavy capsules.
        background: 'radial-gradient(120% 160% at 50% -30%, #1a3142 0%, #0c1c2b 55%, #081420 100%)',
        borderTop: '1px solid rgba(247,200,65,0.5)',
        borderBottom: '1px solid rgba(247,200,65,0.5)',
        boxShadow: 'inset 0 1px 0 rgba(255,236,150,0.18), inset 0 -10px 24px -10px rgba(0,0,0,0.6)',
      }}
    >
      {/* inner gilded frame */}
      <span aria-hidden className="pointer-events-none" style={{ position: 'absolute', inset: 3, borderRadius: 6, border: '1px solid rgba(247,200,65,0.16)' }} />

      {/* Level shield + XP */}
      <div className="relative flex items-center gap-2 min-w-0">
        <LevelShield level={level ?? 1} loading={statsLoading} />
        <div className="flex flex-col gap-1 w-[56px]">
          <div className="flex items-center justify-between leading-none">
            <span className="font-bold tracking-[0.18em]" style={{ fontSize: 8, color: 'rgba(247,200,65,0.8)' }}>LIV</span>
            {!statsLoading && <span className="font-bold tabular-nums" style={{ fontSize: 8, color: 'rgba(238,245,249,0.4)' }}>{Math.round(xpPct)}%</span>}
          </div>
          <div className="h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.16)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.35)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(180deg, #FFE682, #F2B007)', boxShadow: '0 0 8px rgba(247,200,65,0.8)' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(xpPct, 4)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* gem divider */}
      <span aria-hidden className="relative shrink-0" style={{ width: 1, height: 22, background: 'linear-gradient(180deg, transparent, rgba(247,200,65,0.45), transparent)' }} />

      {/* Gold — coin + number */}
      <div className="relative flex items-center gap-1.5 shrink-0">
        <Coin />
        {statsLoading
          ? <div className="w-9 h-3.5 rounded bg-white/10 animate-pulse" />
          : <CountUp value={gold ?? 0} durationMs={650} formatter={n => n.toLocaleString('it-IT')} className="font-bold tabular-nums" style={{ fontFamily: CINZEL, fontSize: 15, color: '#FFE08A', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        }
      </div>

      {/* gem divider */}
      <span aria-hidden className="relative shrink-0" style={{ width: 1, height: 22, background: 'linear-gradient(180deg, transparent, rgba(79,209,197,0.5), transparent)' }} />

      {/* Gemme — gem + number */}
      <div className="relative flex items-center gap-1.5 shrink-0">
        <Gem />
        {statsLoading
          ? <div className="w-8 h-3.5 rounded bg-white/10 animate-pulse" />
          : <CountUp value={gemme ?? 0} durationMs={650} formatter={n => n.toLocaleString('it-IT')} className="font-bold tabular-nums" style={{ fontFamily: CINZEL, fontSize: 15, color: '#8FF0E6', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        }
      </div>

      {/* gem divider */}
      <span aria-hidden className="relative shrink-0" style={{ width: 1, height: 22, background: 'linear-gradient(180deg, transparent, rgba(247,200,65,0.45), transparent)' }} />

      {/* Timer + bell */}
      <div className="relative flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <Hourglass color={timerColor} />
          <span className={`font-mono font-bold tabular-nums ${timerCritical ? 'animate-pulse' : ''}`} style={{ fontSize: 13, color: timerColor, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
            {timerFormatted || '--:--'}
          </span>
        </div>

        <button onClick={onBell} className="relative flex items-center justify-center p-1" aria-label="Notifiche">
          {unreadCount > 0 && (
            <motion.span
              aria-hidden className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(240,85,106,0.45) 0%, transparent 65%)' }}
              animate={{ opacity: [0, 0.6, 0], scale: [0.6, 1.35, 0.6] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <motion.svg
            width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden
            animate={unreadCount > 0 ? { rotate: [0, -12, 12, -8, 8, 0] } : { rotate: 0 }}
            transition={{ duration: 0.8, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 2.4, ease: 'easeInOut' }}
            style={{ transformOrigin: '50% 14%', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
          >
            <defs>
              <linearGradient id="wcBell" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFE9A6" />
                <stop offset="1" stopColor="#E8B22E" />
              </linearGradient>
            </defs>
            <path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5Z" fill="url(#wcBell)" stroke="#9A6B14" strokeWidth="1" strokeLinejoin="round" />
            <path d="M10.2 19.2a2 2 0 0 0 3.6 0" stroke="#9A6B14" strokeWidth="1.4" strokeLinecap="round" />
          </motion.svg>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 min-w-[15px] h-[15px] px-0.5 rounded-full text-white text-[9px] font-bold flex items-center justify-center leading-none"
              style={{ background: 'linear-gradient(180deg, #FF6B7C, #E03450)', boxShadow: '0 0 7px rgba(240,85,106,0.6)' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
