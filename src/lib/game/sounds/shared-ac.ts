/**
 * Shared singleton AudioContext for one-shot game event sounds.
 *
 * Why singleton:
 *   – Eliminates "race condition" when multiple sounds fire rapidly
 *     (knockout + defeat in quick succession) — no context creation
 *     overhead, no risk of hitting browser limits on AudioContext count.
 *   – The context is never explicitly closed; it stays warm between calls.
 *   – Automatically resumes if the browser suspended it after inactivity.
 */

let _ac: AudioContext | null = null

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
