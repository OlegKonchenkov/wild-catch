'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Lightweight number-counter animation. Ticks the displayed value from
 * the current display state to the target over `durationMs`, with
 * easeOutCubic so it feels snappy at the start and settles smoothly.
 *
 * Use case: gold/exp/score totals that change in response to gameplay —
 * a count-up makes the gain visible instead of a hard jump.
 *
 *   <CountUp value={gold} formatter={n => n.toLocaleString('it-IT')} />
 *
 * Differences vs `useTweenedInteger`:
 *  - Renders as a JSX component (no caller-side wiring of the tween)
 *  - Accepts a `formatter` so currency/locale formatting comes free
 *  - Snaps backward immediately if value decreases (no awkward
 *    backwards-ticking on, e.g., a refund or correction)
 */
interface Props {
  value: number
  durationMs?: number
  formatter?: (n: number) => string
  className?: string
  style?: React.CSSProperties
}

export default function CountUp({
  value,
  durationMs = 600,
  formatter = (n) => String(n),
  className,
  style,
}: Props) {
  const [display, setDisplay] = useState(value)
  const rafRef = useRef<number | null>(null)
  const startValueRef = useRef(value)
  const startTimeRef = useRef(0)

  useEffect(() => {
    // Snap immediately on first render so we don't animate from 0 to N
    if (startTimeRef.current === 0) {
      setDisplay(value)
      startValueRef.current = value
      startTimeRef.current = 1 // sentinel — non-zero
      return
    }

    // Backward change → snap (refund / correction). Animations that
    // count down look like a bug, not feedback.
    if (value < display) {
      setDisplay(value)
      return
    }

    if (value === display) return

    const from = display
    const to = value
    const startAt = performance.now()
    startValueRef.current = from

    const tick = () => {
      const t = Math.min(1, (performance.now() - startAt) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      const next = Math.round(from + (to - from) * eased)
      setDisplay(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [value, durationMs, display])

  return (
    <span className={className} style={style}>
      {formatter(display)}
    </span>
  )
}
