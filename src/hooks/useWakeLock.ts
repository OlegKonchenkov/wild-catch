'use client'
import { useEffect, useRef } from 'react'

/**
 * Hold a Screen Wake Lock while the component is mounted and the tab is
 * visible. On outdoor sessions the screen would otherwise sleep, killing the
 * GPS marker animation and any in-flight encounter / boss / duel screens.
 *
 * Behaviour:
 *  - Best-effort: the API is unavailable on iOS Safari < 16.4 and on some
 *    Android browsers. Failures are silent; the rest of the app keeps working.
 *  - Auto-releases on unmount and re-acquires when the tab regains focus
 *    (the OS releases the lock on tab hide; we must request it again).
 *  - The optional `enabled` flag lets callers gate the lock on game state
 *    (e.g. only while inside an active session).
 */
export function useWakeLock(enabled: boolean = true): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (typeof navigator === 'undefined') return
    const wl = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock
    if (!wl?.request) return

    let cancelled = false

    async function acquire() {
      try {
        const sentinel = await wl!.request('screen')
        if (cancelled) {
          await sentinel.release().catch(() => {})
          return
        }
        sentinelRef.current = sentinel
        // The OS may revoke the lock (e.g. when the tab goes to background).
        // We clear our ref so the visibility handler will re-request.
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null
        })
      } catch {
        // NotAllowedError, SecurityError, NotSupportedError — all silent
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible' && !sentinelRef.current) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      const s = sentinelRef.current
      sentinelRef.current = null
      if (s) void s.release().catch(() => {})
    }
  }, [enabled])
}
