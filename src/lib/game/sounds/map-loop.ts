/**
 * Map background ambience — enchanted forest, synthesized via Web Audio API.
 *
 * Layers:
 *   - Gentle melodic loop: 22 s G-major-pentatonic phrase, music-box timbre,
 *     repeats seamlessly using AudioContext scheduling
 *   - Random chimes: bell tones from C pentatonic every 7–20 s (kept from before)
 *   - Rare bird call: soft chirp every 12–30 s (kept from before)
 *
 * Background handling:
 *   The AudioContext is suspended when the page goes into background (PWA/tab
 *   switch) and resumed when it returns to the foreground.
 */

// ── G-major pentatonic melody (16 notes, 22.2 s) ──────────────────────────────
// [frequency Hz, duration seconds]
const MELODY: [number, number][] = [
  [493.88, 1.2],   // B4
  [587.33, 1.2],   // D5
  [659.25, 1.2],   // E5
  [783.99, 1.8],   // G5  ← held
  [659.25, 1.2],   // E5
  [587.33, 1.2],   // D5
  [493.88, 1.2],   // B4
  [440.00, 1.8],   // A4  ← held
  [392.00, 1.2],   // G4
  [440.00, 1.2],   // A4
  [493.88, 1.2],   // B4
  [587.33, 1.2],   // D5
  [659.25, 1.8],   // E5  ← held
  [587.33, 1.2],   // D5
  [493.88, 1.2],   // B4
  [392.00, 2.4],   // G4  ← closing note, long
]
const LOOP_DUR = MELODY.reduce((s, [, d]) => s + d, 0)  // 22.2 s

// ── Note renderer ─────────────────────────────────────────────────────────────
// Piano-like timbre: sine fundamental + soft octave harmonic (18 %)
// Envelope: fast attack → quick decay to sustain → release
function scheduleNote(
  ac: AudioContext,
  freq: number,
  t: number,
  dur: number,
  noteVol: number,
): void {
  const masterG = ac.createGain()
  masterG.gain.setValueAtTime(0, t)
  masterG.gain.linearRampToValueAtTime(noteVol, t + 0.013)        // attack
  masterG.gain.exponentialRampToValueAtTime(noteVol * 0.52, t + 0.10) // decay
  masterG.gain.setValueAtTime(noteVol * 0.52, t + dur * 0.58)    // sustain
  masterG.gain.exponentialRampToValueAtTime(0.0001, t + dur)      // release
  masterG.connect(ac.destination)

  // Fundamental
  const o1 = ac.createOscillator()
  o1.type = 'sine'; o1.frequency.value = freq
  o1.connect(masterG); o1.start(t); o1.stop(t + dur + 0.05)

  // Octave harmonic — removes the "metallic" pure-sine quality
  const o2 = ac.createOscillator()
  const o2g = ac.createGain()
  o2.type = 'sine'; o2.frequency.value = freq * 2; o2g.gain.value = 0.18
  o2.connect(o2g); o2g.connect(masterG)
  o2.start(t); o2.stop(t + dur + 0.05)
}

export function startMapAmbience(vol = 0.12): () => void {
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

  // ── Page-visibility handler: suspend audio in background ─────────────────
  function onVisibility() {
    if (document.hidden) {
      actx.suspend().catch(() => {})
    } else {
      actx.resume().catch(() => {})
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  // ── Melodic loop ──────────────────────────────────────────────────────────
  function scheduleMelodyLoop(startTime: number): void {
    if (stopped) return
    let t = startTime
    for (const [freq, dur] of MELODY) {
      scheduleNote(actx, freq, t, dur, vol * 0.22)
      t += dur
    }
    // Re-schedule next loop 1 s before this one ends (keeps AudioContext clock tight)
    const msUntilNext = Math.max(50, (LOOP_DUR - 1.0) * 1000)
    const timer = setTimeout(() => scheduleMelodyLoop(startTime + LOOP_DUR), msUntilNext)
    timers.push(timer)
  }
  scheduleMelodyLoop(actx.currentTime + 0.4)  // tiny initial gap

  // ── Random magic chimes — C pentatonic bell tones ─────────────────────────
  const chimeNotes = [523.25, 659.25, 783.99, 880.0, 1046.5, 1318.5, 1567.98]

  function scheduleChime(): void {
    if (stopped) return
    const delay = 7000 + Math.random() * 13000
    const t = setTimeout(() => {
      if (stopped) return
      const now  = actx.currentTime
      const base = Math.floor(Math.random() * (chimeNotes.length - 2))
      const cnt  = 2 + Math.floor(Math.random() * 2)
      for (let j = 0; j < cnt; j++) {
        const freq = chimeNotes[base + j]
        const o    = actx.createOscillator()
        const g    = actx.createGain()
        o.type = 'sine'; o.frequency.value = freq
        const t2 = now + j * 0.14
        g.gain.setValueAtTime(0, t2)
        g.gain.linearRampToValueAtTime(vol * (0.28 + j * 0.05), t2 + 0.015)
        g.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.1)
        o.connect(g); g.connect(actx.destination)
        o.start(t2); o.stop(t2 + 1.15)
      }
      scheduleChime()
    }, delay)
    timers.push(t)
  }
  scheduleChime()

  // ── Rare bird call ────────────────────────────────────────────────────────
  function scheduleBird(): void {
    if (stopped) return
    const delay = 12000 + Math.random() * 18000
    const t = setTimeout(() => {
      if (stopped) return
      const now  = actx.currentTime
      const freq = 900 + Math.random() * 500
      const o    = actx.createOscillator()
      const g    = actx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(freq, now)
      o.frequency.exponentialRampToValueAtTime(freq * 1.22, now + 0.06)
      o.frequency.exponentialRampToValueAtTime(freq * 0.88, now + 0.14)
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(vol * 0.38, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      o.connect(g); g.connect(actx.destination)
      o.start(now); o.stop(now + 0.20)
      scheduleBird()
    }, delay)
    timers.push(t)
  }
  scheduleBird()

  // ── Stop / cleanup ────────────────────────────────────────────────────────
  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    timers.forEach(clearTimeout)
    actx.close().catch(() => {})
  }
}
