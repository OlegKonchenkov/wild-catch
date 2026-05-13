'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Smoothly interpolates an integer-valued target over a short duration so
 * a counter that jumps from N -> N+7 (e.g. step counter receiving an
 * authoritative server tick) ticks visibly through the intermediate
 * values instead of snapping.
 *
 * - Sub-frame integers only (rounded each tick).
 * - When the target changes mid-tween, the animation restarts from the
 *   current displayed value, never backwards-glitching past the user.
 * - Cleans up its rAF on unmount.
 *
 * @param target  Authoritative target value to animate towards.
 * @param durationMs Total tween duration. Default 500 ms — gentle but
 *                   visible at typical step-counter cadences.
 */
export default function useTweenedInteger(target: number, durationMs = 500): number {
  const [display, setDisplay] = useState(target)
  const rafRef    = useRef<number | null>(null)
  const startRef  = useRef({ value: target, ts: 0 })
  const targetRef = useRef(target)

  useEffect(() => {
    targetRef.current = target

    // Snap forward instantly on first frame (no animation on mount).
    if (startRef.current.ts === 0) {
      startRef.current = { value: target, ts: performance.now() }
      setDisplay(target)
      return
    }

    // Start a new tween from whatever is currently displayed.
    setDisplay(current => {
      startRef.current = { value: current, ts: performance.now() }
      return current
    })

    const tick = () => {
      const t = (performance.now() - startRef.current.ts) / durationMs
      if (t >= 1) {
        setDisplay(targetRef.current)
        rafRef.current = null
        return
      }
      // Ease-out (cubic) — feels snappy at the start, settles at the end.
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.round(startRef.current.value + (targetRef.current - startRef.current.value) * eased)
      setDisplay(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [target, durationMs])

  return display
}
