/**
 * Map background ambience — enchanted forest, synthesized via Web Audio API.
 *
 * Layers:
 *   1. Main melody   – G-major pentatonic, 4 phrases × ~5 s = ~21 s loop,
 *                      richer timbre: sine + octave + 5th-harmonic
 *   2. Counter-melody– soft high voice echoing key phrase endings
 *   3. Bass pulses   – pizzicato G2/D2/A2 one per phrase, adds warmth
 *   4. Random chimes – G pentatonic bell tones every 6–18 s
 *   5. Rare bird call– soft chirp every 12–28 s
 */

// ── Melody data ────────────────────────────────────────────────────────────────
// G major pentatonic: G4=392 A4=440 B4=493.88 D5=587.33 E5=659.25 G5=783.99
// 4 phrases with varied rhythm — short/quick notes alternate with held notes
// for a more lively, Stardew-Valley-style feel while staying chill

const MELODY: [number, number][] = [
  // Phrase A — flowing introduction
  [392.00, 0.55],  // G4
  [493.88, 0.40],  // B4
  [587.33, 0.40],  // D5
  [659.25, 0.85],  // E5  ← held
  [587.33, 0.40],  // D5
  [493.88, 0.40],  // B4
  [440.00, 0.55],  // A4
  [392.00, 0.85],  // G4  ← held, phrase end
  // Phrase B — energetic rise
  [587.33, 0.30],  // D5
  [659.25, 0.30],  // E5
  [783.99, 0.65],  // G5  ← held high
  [659.25, 0.30],  // E5
  [587.33, 0.30],  // D5
  [493.88, 0.55],  // B4  ← settling
  [440.00, 0.30],  // A4
  [392.00, 0.55],  // G4
  [493.88, 1.20],  // B4  ← long hold, phrase end
  // Phrase C — lyrical high phrase
  [659.25, 0.45],  // E5
  [783.99, 0.80],  // G5  ← held, dramatic
  [659.25, 0.40],  // E5
  [587.33, 0.40],  // D5
  [493.88, 0.45],  // B4
  [587.33, 0.80],  // D5  ← held
  [659.25, 0.40],  // E5
  [783.99, 1.35],  // G5  ← long hold, phrase peak
  // Phrase D — gentle descent to resolve
  [659.25, 0.40],  // E5
  [587.33, 0.35],  // D5
  [493.88, 0.35],  // B4
  [440.00, 0.55],  // A4
  [392.00, 0.35],  // G4
  [440.00, 0.35],  // A4
  [493.88, 0.55],  // B4
  [587.33, 0.40],  // D5
  [392.00, 1.80],  // G4  ← long closing note
]
const LOOP_DUR = MELODY.reduce((s, [, d]) => s + d, 0)  // ≈ 20.8 s

// ── Counter-melody moments — high echoes after each phrase end ────────────────
// Plays at specific offsets within the loop
const COUNTER: [number, number, number][] = [
  // [offset_from_loop_start, freq, dur]
  [4.40, 1174.66, 0.60],   // D6 — echoes after phrase A's G4 hold
  [4.40, 1318.51, 0.45],   // E6
  [10.00, 1567.98, 0.55],  // G6 — echoes phrase B's B4 hold
  [10.00, 1318.51, 0.40],  // E6
  [15.55, 1567.98, 0.65],  // G6 — sparkle after phrase C's peak G5
  [15.55, 1975.53, 0.45],  // B6
  [15.55, 1318.51, 0.50],  // E6 slightly after
]

// ── Bass pulse moments — one pizzicato bass note per phrase ───────────────────
const BASS: [number, number, number][] = [
  // [offset, freq, dur]
  [0.0,  97.999, 0.65],   // G2 — phrase A start
  [4.95, 97.999, 0.65],   // G2 — phrase B start
  [9.95, 73.416, 0.70],   // D2 — phrase C (adds colour)
  [15.6, 97.999, 0.65],   // G2 — phrase D start
  [18.5, 110.00, 0.55],   // A2 — pre-resolve
]

// ── Note renderer ─────────────────────────────────────────────────────────────
// Timbre: sine fundamental + octave harmonic (18%) + 5th harmonic (8%)
// giving a richer "magic bell / music box" quality
function scheduleNote(ac: AudioContext, freq: number, t: number, dur: number, vol: number): void {
  const master = ac.createGain()
  master.gain.setValueAtTime(0, t)
  master.gain.linearRampToValueAtTime(vol, t + 0.012)
  master.gain.exponentialRampToValueAtTime(vol * 0.54, t + 0.10)
  master.gain.setValueAtTime(vol * 0.54, t + dur * 0.60)
  master.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  master.connect(ac.destination)

  const o1 = ac.createOscillator()
  o1.type = 'sine'; o1.frequency.value = freq
  o1.connect(master); o1.start(t); o1.stop(t + dur + 0.05)

  const o2 = ac.createOscillator()
  const g2 = ac.createGain()
  o2.type = 'sine'; o2.frequency.value = freq * 2; g2.gain.value = 0.16
  o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(t + dur + 0.05)

  // 5th harmonic — adds the tiny shimmer that lifts it above "simple sine"
  const o3 = ac.createOscillator()
  const g3 = ac.createGain()
  o3.type = 'sine'; o3.frequency.value = freq * 3; g3.gain.value = 0.06
  o3.connect(g3); g3.connect(master); o3.start(t); o3.stop(t + dur + 0.03)
}

// ── Counter-melody renderer — sine only, very soft, quick decay ───────────────
function scheduleHigh(ac: AudioContext, freq: number, t: number, dur: number, vol: number): void {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol * 0.18, t + 0.010)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + dur + 0.03)
}

// ── Bass pulse renderer — short pizzicato sine ────────────────────────────────
function scheduleBass(ac: AudioContext, freq: number, t: number, dur: number, vol: number): void {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(vol * 0.28, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + dur + 0.05)
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

  // ── Page-visibility handler ───────────────────────────────────────────────
  function onVisibility() {
    if (document.hidden) actx.suspend().catch(() => {})
    else actx.resume().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVisibility)

  // ── Melodic loop ──────────────────────────────────────────────────────────
  function scheduleMelodyLoop(startTime: number): void {
    if (stopped) return

    // Main melody
    let t = startTime
    for (const [freq, dur] of MELODY) {
      scheduleNote(actx, freq, t, dur, vol * 0.22)
      t += dur
    }

    // Counter-melody (high echoes)
    for (const [offset, freq, dur] of COUNTER) {
      scheduleHigh(actx, freq, startTime + offset, dur, vol)
    }

    // Bass pulses
    for (const [offset, freq, dur] of BASS) {
      scheduleBass(actx, freq, startTime + offset, dur, vol)
    }

    const msUntilNext = Math.max(50, (LOOP_DUR - 1.0) * 1000)
    const timer = setTimeout(() => scheduleMelodyLoop(startTime + LOOP_DUR), msUntilNext)
    timers.push(timer)
  }
  scheduleMelodyLoop(actx.currentTime + 0.4)

  // ── Random magic chimes — G pentatonic bell tones ─────────────────────────
  const chimeNotes = [392.00, 493.88, 587.33, 659.25, 783.99, 880.00, 1046.5, 1318.5, 1567.98]

  function scheduleChime(): void {
    if (stopped) return
    const delay = 6000 + Math.random() * 12000
    const t = setTimeout(() => {
      if (stopped) return
      const now  = actx.currentTime
      const base = Math.floor(Math.random() * (chimeNotes.length - 3))
      const cnt  = 2 + Math.floor(Math.random() * 3)   // 2–4 chime notes
      for (let j = 0; j < cnt; j++) {
        const freq = chimeNotes[base + j]
        const o    = actx.createOscillator()
        const g    = actx.createGain()
        o.type = 'sine'; o.frequency.value = freq
        const t2 = now + j * 0.16
        g.gain.setValueAtTime(0, t2)
        g.gain.linearRampToValueAtTime(vol * (0.25 + j * 0.04), t2 + 0.015)
        g.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.3)
        o.connect(g); g.connect(actx.destination)
        o.start(t2); o.stop(t2 + 1.35)
      }
      scheduleChime()
    }, delay)
    timers.push(t)
  }
  scheduleChime()

  // ── Rare bird call ────────────────────────────────────────────────────────
  function scheduleBird(): void {
    if (stopped) return
    const delay = 12000 + Math.random() * 16000
    const t = setTimeout(() => {
      if (stopped) return
      const now  = actx.currentTime
      const freq = 920 + Math.random() * 480
      const o    = actx.createOscillator()
      const g    = actx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(freq, now)
      o.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.07)
      o.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.16)
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(vol * 0.36, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.20)
      o.connect(g); g.connect(actx.destination)
      o.start(now); o.stop(now + 0.22)
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
