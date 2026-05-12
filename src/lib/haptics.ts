// Small wrapper around navigator.vibrate so callers don't repeat
// availability checks. Patterns are tuned to feel like distinct events on
// Android (iOS Safari currently ignores navigator.vibrate — best-effort only).
//
// Calls are silent no-ops when:
//  - running on the server / outside a browser
//  - the API is missing (iOS)
//  - the user's OS has disabled vibration

type Pattern = number | number[]

function safeVibrate(pattern: Pattern): void {
  if (typeof navigator === 'undefined') return
  const v = navigator.vibrate?.bind(navigator)
  if (!v) return
  try { v(pattern) } catch {}
}

export const haptics = {
  /** Short tap — UI confirmation, button press in flow. */
  tap:           () => safeVibrate(15),
  /** Tiny double-tick — selection toggle, scroll-snap. */
  selection:     () => safeVibrate([8, 25, 8]),
  /** A wild creature appeared — short crescendo. */
  encounter:     () => safeVibrate([40, 30, 60]),
  /** Successful catch — celebratory triple pulse. */
  catchSuccess:  () => safeVibrate([30, 40, 30, 40, 80]),
  /** Failed catch / flee — warning pair. */
  catchFail:     () => safeVibrate([60, 60, 60]),
  /** Level up — strong long pulse. */
  levelUp:       () => safeVibrate([20, 40, 80, 40, 120]),
  /** Mission complete — happy double-tap. */
  missionDone:   () => safeVibrate([25, 40, 25]),
  /** Boss / duel victory. */
  victory:       () => safeVibrate([60, 60, 60, 60, 200]),
  /** Boss / duel defeat. */
  defeat:        () => safeVibrate([200]),
  /** Egg hatched. */
  hatch:         () => safeVibrate([20, 30, 20, 30, 90]),
}
