/**
 * Shared singleton AudioContext for one-shot game event sounds.
 *
 * Why singleton:
 *   – Eliminates "race condition" when multiple sounds fire rapidly
 *     (knockout + defeat in quick succession) — no context creation
 *     overhead, no risk of hitting browser limits on AudioContext count.
 *   – The context is never explicitly closed; it stays warm between calls.
 *   – Automatically resumes if the browser suspended it after inactivity.
 *
 * Sound queue:
 *   – getSoundStartTime() staggers rapid concurrent calls by a small gap so
 *     simultaneous sounds (e.g. level-up + mission complete) play in sequence
 *     rather than piling on top of each other.
 *
 * Ambience ducking:
 *   – Call registerAmbienceDucking(duck, unduck) to register callbacks.
 *     Every getSoundStartTime() call will automatically duck the ambience
 *     and reschedule the unduck to fire after the FULL sound queue drains.
 *     This means two back-to-back sounds both get heard clearly with a single
 *     duck/unduck arc, not two separate ones.
 *   – Call registerAmbienceDucking(null, null) to unregister (e.g. on unmount).
 */

let _ac: AudioContext | null = null
let _nextSoundAt = 0  // AudioContext time (seconds) when next queued sound may start

// ── AudioContext constructor helper ───────────────────────────────────────────
// Resolves the standard AudioContext on every browser, including the
// webkit-prefixed legacy build still used by older iOS Safari.
type ACCtor = new () => AudioContext

export function newAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { AudioContext?: ACCtor; webkitAudioContext?: ACCtor }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  try { return new Ctor() } catch { return null }
}

// ── AudioContext unlock (mobile autoplay policy) ──────────────────────────────
// iOS/Android block AudioContext.resume() outside a user-gesture handler.
// We register one-time capture listeners so the first tap/click resumes the AC.
function _scheduleUnlock(ac: AudioContext): void {
  if (ac.state === 'running') return
  const unlock = () => { if (ac.state === 'suspended') ac.resume().catch(() => {}) }
  for (const ev of ['click', 'touchend', 'keydown'] as const) {
    document.addEventListener(ev, unlock, { once: true, capture: true })
  }
}

// ── Ambience ducking ──────────────────────────────────────────────────────────
type DuckFn   = (duckTo: number, rampMs: number) => void
type UnduckFn = (rampMs: number) => void

let _duckFn:   DuckFn   | null = null
let _unduckFn: UnduckFn | null = null
let _unduckTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Register (or unregister) duck/unduck callbacks.
 * Typically called once on map-page mount/unmount.
 */
export function registerAmbienceDucking(
  duck:   DuckFn   | null,
  unduck: UnduckFn | null,
): void {
  _duckFn   = duck
  _unduckFn = unduck
  if (!duck && _unduckTimer) {
    clearTimeout(_unduckTimer)
    _unduckTimer = null
  }
}

export function getSharedAC(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!_ac || _ac.state === 'closed') {
    const fresh = newAudioContext()
    if (!fresh) return null
    _ac = fresh
    _scheduleUnlock(fresh)
  }

  // Browser may suspend the context after user leaves the page then returns
  if (_ac && _ac.state === 'suspended') {
    const ac = _ac
    ac.resume().catch(() => {})
    _scheduleUnlock(ac)
  }

  return _ac
}

/**
 * Returns the AudioContext start time reserved for the next sound, staggering
 * rapid concurrent calls so they never overlap.
 *
 * Also manages ambience ducking automatically:
 *   – Ducks immediately on first call in a burst.
 *   – Cancels any pending unduck and reschedules it to fire after the ENTIRE
 *     queued burst has finished + a 600 ms tail buffer.
 *
 * @param durationS  Estimated playback length of this sound in seconds.
 */
export function getSoundStartTime(durationS: number): number {
  const ac = getSharedAC()
  if (!ac) return 0
  const now = ac.currentTime
  const GAP_S = 0.12  // 120 ms breathing room between stacked sounds
  const start = Math.max(now, _nextSoundAt)
  _nextSoundAt = start + durationS + GAP_S

  // Duck ambience immediately (safe to call repeatedly — map-loop handles it)
  if (_duckFn) _duckFn(0.09, 280)

  // Reset the unduck timer to fire after the full queue clears
  if (_unduckFn) {
    if (_unduckTimer) clearTimeout(_unduckTimer)
    const msUntilDone = (_nextSoundAt - now + 0.6) * 1000
    _unduckTimer = setTimeout(() => {
      _unduckTimer = null
      if (_unduckFn) _unduckFn(1000)
    }, msUntilDone)
  }

  return start
}
