'use client'
import { useEffect, useState } from 'react'
import { GiSparkles, GiTwoCoins, GiPawPrint } from 'react-icons/gi'
import { activeEventBonuses, EVENT_BONUS_LABELS, type EventBonusKind } from '@/lib/game/event-bonuses'

/**
 * HUD badges for the timed bonuses an `evento` pin/QR grants.
 *
 * Without this the bonus would be invisible: the player claims a pin, gets told
 * "EXP doubled for 15 minutes", and then has no way to tell whether it's still
 * running. Mirrors the Esca countdown next to it.
 */

const THEME: Record<EventBonusKind, { icon: typeof GiSparkles; accent: string; soft: string; text: string }> = {
  exp_boost:   { icon: GiSparkles, accent: 'rgba(247,200,65,0.72)',  soft: 'rgba(247,200,65,0.22)',  text: '#FFE9A8' },
  gold_rain:   { icon: GiTwoCoins, accent: 'rgba(212,169,106,0.72)', soft: 'rgba(212,169,106,0.22)', text: '#F3DCB4' },
  spawn_boost: { icon: GiPawPrint, accent: 'rgba(192,132,252,0.72)', soft: 'rgba(192,132,252,0.22)', text: '#E6D2FF' },
}

function secondsLeft(until: string, now: number): number {
  return Math.max(0, Math.round((Date.parse(until) - now) / 1000))
}

export default function EventBonusBadges({ bonuses }: { bonuses: unknown }) {
  const [now, setNow] = useState(() => Date.now())

  const active = activeEventBonuses(bonuses, now)

  // Only tick while something is actually running.
  useEffect(() => {
    if (active.length === 0) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active.length])

  if (active.length === 0) return null

  return (
    <>
      {active.map(({ kind, mult, until }) => {
        const theme = THEME[kind]
        const Icon = theme.icon
        const left = secondsLeft(until, now)
        return (
          <div
            key={kind}
            className="relative overflow-hidden rounded-xl px-2 py-1.5 flex items-center gap-1.5 whitespace-nowrap"
            style={{
              background:
                `radial-gradient(circle at 26% 18%, ${theme.soft}, transparent 36%), ` +
                'linear-gradient(148deg, rgba(24,20,8,0.92) 0%, rgba(10,12,20,0.96) 100%)',
              border: `1.5px solid ${theme.accent}`,
              boxShadow: `0 0 14px ${theme.soft}, 0 5px 14px rgba(0,0,0,0.42)`,
              backdropFilter: 'blur(10px) saturate(1.18)',
            }}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ background: theme.soft, border: `1.5px solid ${theme.accent}` }}
            >
              <Icon size={14} color={theme.text} />
            </span>
            <div className="flex flex-col items-start leading-none">
              <span
                className="text-[8px] font-black uppercase tracking-[0.12em]"
                style={{ color: theme.text }}
              >
                {EVENT_BONUS_LABELS[kind]} ×{mult}
              </span>
              <span className="mt-0.5 text-[9px] font-mono font-bold tabular-nums" style={{ color: '#F2F6FF' }}>
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}
