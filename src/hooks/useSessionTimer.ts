'use client'
import { useState, useEffect, useRef } from 'react'

interface SessionTimerOptions {
  endAt: string | null   // ISO timestamp when session ends (null = no end time)
  onExpired?: () => void // called once when countdown hits 0
}

interface SessionTimerResult {
  remaining: number | null    // seconds remaining, null if no endAt
  formatted: string           // "2h 14m" or "45m 30s" or "Scaduta"
  isExpired: boolean
  isWarning: boolean          // true when < 10 minutes left
  isCritical: boolean         // true when < 2 minutes left
}

export function useSessionTimer({ endAt, onExpired }: SessionTimerOptions): SessionTimerResult {
  const [remaining, setRemaining] = useState<number | null>(null)
  const expiredFiredRef = useRef(false)

  useEffect(() => {
    if (!endAt) { setRemaining(null); return }

    function tick() {
      const secs = Math.floor((new Date(endAt!).getTime() - Date.now()) / 1000)
      setRemaining(Math.max(0, secs))
      if (secs <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true
        onExpired?.()
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [endAt, onExpired])

  if (remaining === null) {
    return { remaining: null, formatted: '', isExpired: false, isWarning: false, isCritical: false }
  }

  const isExpired = remaining === 0
  const isWarning = remaining > 0 && remaining < 600   // < 10 min
  const isCritical = remaining > 0 && remaining < 120  // < 2 min

  let formatted: string
  if (isExpired) {
    formatted = 'Scaduta'
  } else if (remaining >= 3600) {
    const h = Math.floor(remaining / 3600)
    const m = Math.floor((remaining % 3600) / 60)
    formatted = `${h}h ${m}m`
  } else if (remaining >= 60) {
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    formatted = `${m}m ${s.toString().padStart(2, '0')}s`
  } else {
    formatted = `${remaining}s`
  }

  return { remaining, formatted, isExpired, isWarning, isCritical }
}
