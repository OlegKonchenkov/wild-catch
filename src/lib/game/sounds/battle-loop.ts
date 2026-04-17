/**
 * Battle background music — two separate loops synthesized via Web Audio API.
 *
 *   startDuelLoop  – A-minor pentatonic phrase (~20 s), tense/energetic
 *   startBossLoop  – D-natural-minor phrase (~25 s), epic/dramatic
 *
 * Each function returns a stop() callback for cleanup on unmount.
 * Audio is suspended when the page goes to background (PWA / tab switch).
 */

// ── Piano-like note renderer ───────────────────────────────────────────────────
// Sine fundamental + soft octave harmonic (18 %), fast attack → decay → release
function scheduleNote(
  ac: AudioContext,
  freq: number,
  t: number,
  dur: number,
  noteVol: number,
): void {
  const masterG = ac.createGain()
  masterG.gain.setValueAtTime(0, t)
  masterG.gain.linearRampToValueAtTime(noteVol, t + 0.013)
  masterG.gain.exponentialRampToValueAtTime(noteVol * 0.50, t + 0.10)
  masterG.gain.setValueAtTime(noteVol * 0.50, t + dur * 0.58)
  masterG.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  masterG.connect(ac.destination)

  const o1 = ac.createOscillator()
  o1.type = 'sine'; o1.frequency.value = freq
  o1.connect(masterG); o1.start(t); o1.stop(t + dur + 0.05)

  const o2 = ac.createOscillator()
  const o2g = ac.createGain()
  o2.type = 'sine'; o2.frequency.value = freq * 2; o2g.gain.value = 0.18
  o2.connect(o2g); o2g.connect(masterG)
  o2.start(t); o2.stop(t + dur + 0.05)
}

// ── Duel loop — A-minor pentatonic (19.2 s) ───────────────────────────────────
// Tense, driving energy: A4 C5 D5 E5 G5, slightly shorter notes for urgency
const DUEL_MELODY: [number, number][] = [
  [440.00, 0.9],   // A4
  [523.25, 0.9],   // C5
  [587.33, 1.2],   // D5  ← held
  [659.25, 0.9],   // E5
  [783.99, 1.5],   // G5  ← held
  [659.25, 0.9],   // E5
  [587.33, 0.9],   // D5
  [523.25, 1.2],   // C5  ← held
  [440.00, 0.9],   // A4
  [392.00, 0.9],   // G4
  [440.00, 0.9],   // A4
  [523.25, 0.9],   // C5
  [659.25, 1.5],   // E5  ← held
  [587.33, 0.9],   // D5
  [523.25, 0.9],   // C5
  [440.00, 1.8],   // A4  ← closing, long
]
const DUEL_DUR = DUEL_MELODY.reduce((s, [, d]) => s + d, 0)  // 19.2 s

export function startDuelLoop(vol = 0.10): () => void {
  if (typeof window === 'undefined') return () => {}

  let ac: AudioContext | null = null
  let stopped = false
  const timers: ReturnType<typeof setTimeout>[] = []

  try {
    ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
  } catch {
    return () => {}
  }
  if (!ac) return () => {}
  const actx: AudioContext = ac

  function onVisibility() {
    if (document.hidden) { actx.suspend().catch(() => {}) }
    else { actx.resume().catch(() => {}) }
  }
  document.addEventListener('visibilitychange', onVisibility)

  function scheduleMelody(startTime: number): void {
    if (stopped) return
    let t = startTime
    for (const [freq, dur] of DUEL_MELODY) {
      scheduleNote(actx, freq, t, dur, vol * 0.22)
      t += dur
    }
    const msUntilNext = Math.max(50, (DUEL_DUR - 1.0) * 1000)
    const timer = setTimeout(() => scheduleMelody(startTime + DUEL_DUR), msUntilNext)
    timers.push(timer)
  }
  scheduleMelody(actx.currentTime + 0.4)

  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    timers.forEach(clearTimeout)
    actx.close().catch(() => {})
  }
}

// ── Boss loop — D-natural-minor (24.6 s) ──────────────────────────────────────
// Epic and dark: D4 E4 F4 A4 C5 as backbone, heavier intervals for drama
const BOSS_MELODY: [number, number][] = [
  [293.66, 1.2],   // D4
  [329.63, 1.2],   // E4
  [349.23, 1.5],   // F4  ← held
  [440.00, 1.2],   // A4
  [523.25, 2.0],   // C5  ← held long
  [440.00, 1.2],   // A4
  [392.00, 1.2],   // G4
  [349.23, 1.5],   // F4  ← held
  [329.63, 1.2],   // E4
  [293.66, 2.0],   // D4  ← held long
  [261.63, 1.2],   // C4
  [293.66, 1.2],   // D4
  [349.23, 1.5],   // F4  ← held
  [440.00, 1.2],   // A4
  [523.25, 1.2],   // C5
  [440.00, 1.2],   // A4
  [349.23, 1.5],   // F4  ← held
  [293.66, 2.8],   // D4  ← closing, long
]
const BOSS_DUR = BOSS_MELODY.reduce((s, [, d]) => s + d, 0)  // 24.6 s

export function startBossLoop(vol = 0.10): () => void {
  if (typeof window === 'undefined') return () => {}

  let ac: AudioContext | null = null
  let stopped = false
  const timers: ReturnType<typeof setTimeout>[] = []

  try {
    ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
  } catch {
    return () => {}
  }
  if (!ac) return () => {}
  const actx: AudioContext = ac

  function onVisibility() {
    if (document.hidden) { actx.suspend().catch(() => {}) }
    else { actx.resume().catch(() => {}) }
  }
  document.addEventListener('visibilitychange', onVisibility)

  function scheduleMelody(startTime: number): void {
    if (stopped) return
    let t = startTime
    for (const [freq, dur] of BOSS_MELODY) {
      scheduleNote(actx, freq, t, dur, vol * 0.22)
      t += dur
    }
    const msUntilNext = Math.max(50, (BOSS_DUR - 1.0) * 1000)
    const timer = setTimeout(() => scheduleMelody(startTime + BOSS_DUR), msUntilNext)
    timers.push(timer)
  }
  scheduleMelody(actx.currentTime + 0.4)

  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    timers.forEach(clearTimeout)
    actx.close().catch(() => {})
  }
}
