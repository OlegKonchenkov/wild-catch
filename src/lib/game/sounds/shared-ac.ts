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
 */

let _ac: AudioContext | null = null
let _nextSoundAt = 0  // AudioContext time (seconds) when next queued sound may start

export function getSharedAC(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!_ac || _ac.state === 'closed') {
    try {
      _ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return null
    }
  }

  // Browser may suspend the context after user leaves the page then returns
  if (_ac && _ac.state === 'suspended') {
    _ac.resume().catch(() => {})
  }

  return _ac
}

/**
 * Returns the AudioContext start time reserved for the next sound, staggering
 * rapid concurrent calls so they never overlap.
 *
 * @param durationS  Estimated playback length of this sound in seconds.
 *                   The next caller will be pushed past (start + durationS + gap).
 */
export function getSoundStartTime(durationS: number): number {
  const ac = getSharedAC()
  if (!ac) return 0
  const now = ac.currentTime
  const GAP_S = 0.12  // 120 ms breathing room between stacked sounds
  const start = Math.max(now, _nextSoundAt)
  _nextSoundAt = start + durationS + GAP_S
  return start
}
