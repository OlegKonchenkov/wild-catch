/**
 * Battle background music — synthesized via Web Audio API.
 *
 *   startEncounterLoop – wild creature fight (C major, upbeat, ~10 s)
 *   startDuelLoop      – PvP duel (A minor, intense, ~14 s)
 *   startBossLoop      – Boss fight (D minor, epic/heavy, ~14 s)
 *
 * All three use square-wave leads (filtered to reduce harshness) +
 * kick-drum + hi-hat rhythm for a clear battle feel vs. the gentle
 * piano map loop. Returns stop() for cleanup on unmount.
 * Audio suspends when the PWA goes to background (visibilitychange).
 */

// ── Shared percussion ─────────────────────────────────────────────────────────

function kick(ac: AudioContext, t: number, vol: number): void {
  const osc = ac.createOscillator()
  const g   = ac.createGain()
  osc.type  = 'sine'
  osc.frequency.setValueAtTime(150, t)
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.15)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.20)
  osc.connect(g); g.connect(ac.destination)
  osc.start(t); osc.stop(t + 0.22)
}

function hihat(ac: AudioContext, t: number, vol: number): void {
  const len  = Math.floor(ac.sampleRate * 0.04)
  const buf  = ac.createBuffer(1, len, ac.sampleRate)
  const d    = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src  = ac.createBufferSource()
  src.buffer = buf
  const hpf  = ac.createBiquadFilter()
  hpf.type   = 'highpass'; hpf.frequency.value = 7000
  const g    = ac.createGain()
  g.gain.value = vol
  src.connect(hpf); hpf.connect(g); g.connect(ac.destination)
  src.start(t); src.stop(t + 0.05)
}

// ── Square-wave note with soft lowpass (retro game feel, not harsh) ───────────
function beatNote(ac: AudioContext, freq: number, t: number, dur: number, vol: number): void {
  // Square lead — lowpass at 2.2 kHz removes the highest harmonics
  const osc = ac.createOscillator()
  const lpf = ac.createBiquadFilter()
  const g   = ac.createGain()
  osc.type  = 'square'
  osc.frequency.value = freq
  lpf.type  = 'lowpass'; lpf.frequency.value = 2200
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol * 0.15, t + 0.008)
  g.gain.setValueAtTime(vol * 0.15, t + dur * 0.72)
  g.gain.linearRampToValueAtTime(0, t + dur)
  osc.connect(lpf); lpf.connect(g); g.connect(ac.destination)
  osc.start(t); osc.stop(t + dur + 0.01)

  // Sine bass one octave below — adds body
  const bass  = ac.createOscillator()
  const bassG = ac.createGain()
  bass.type   = 'sine'; bass.frequency.value = freq / 2
  bassG.gain.setValueAtTime(0, t)
  bassG.gain.linearRampToValueAtTime(vol * 0.10, t + 0.010)
  bassG.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06)
  bass.connect(bassG); bassG.connect(ac.destination)
  bass.start(t); bass.stop(t + dur + 0.08)
}

// ── Rhythm engine — kick on beats 1 & 3, hihat on 2 & 4 ─────────────────────
function scheduleRhythm(
  ac: AudioContext, startTime: number, loopDur: number, beatDur: number, vol: number,
): void {
  let t = startTime
  while (t < startTime + loopDur - beatDur * 0.3) {
    kick(ac, t, vol * 0.32)
    const hatT = t + beatDur * 0.5
    if (hatT < startTime + loopDur) hihat(ac, hatT, vol * 0.13)
    t += beatDur
  }
}

// ── Generic loop starter ──────────────────────────────────────────────────────
function startBattleLoop(
  melody: [number, number][],
  bpm: number,
  vol: number,
): () => void {
  if (typeof window === 'undefined') return () => {}

  let ac: AudioContext | null = null
  let stopped = false
  const timers: ReturnType<typeof setTimeout>[] = []

  try {
    ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
  } catch { return () => {} }
  if (!ac) return () => {}
  const actx: AudioContext = ac

  const loopDur = melody.reduce((s, [, d]) => s + d, 0)
  const beatDur = 60 / bpm

  function onVisibility() {
    if (document.hidden) actx.suspend().catch(() => {})
    else actx.resume().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVisibility)

  function scheduleLoop(startTime: number): void {
    if (stopped) return
    let t = startTime
    for (const [freq, dur] of melody) {
      beatNote(actx, freq, t, dur * 0.88, vol)  // 88% gate = punchy staccato
      t += dur
    }
    scheduleRhythm(actx, startTime, loopDur, beatDur, vol)
    const msUntilNext = Math.max(50, (loopDur - 1.0) * 1000)
    const timer = setTimeout(() => scheduleLoop(startTime + loopDur), msUntilNext)
    timers.push(timer)
  }
  scheduleLoop(actx.currentTime + 0.5)

  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    timers.forEach(clearTimeout)
    actx.close().catch(() => {})
  }
}

// ── Encounter melody — C major pentatonic, bright & upbeat (~10 s, 130 BPM) ──
// Feels like a classic JRPG random encounter: energetic, forward-moving
const ENCOUNTER_MELODY: [number, number][] = [
  // Phrase 1: rising figure
  [523.25, 0.23],  // C5  8th
  [659.25, 0.23],  // E5  8th
  [783.99, 0.46],  // G5  quarter
  [1046.5, 0.23],  // C6  8th
  [783.99, 0.23],  // G5  8th
  [659.25, 0.46],  // E5  quarter
  [523.25, 0.23],  // C5  8th
  [659.25, 0.23],  // E5  8th
  [523.25, 0.46],  // C5  quarter
  // Phrase 2: energetic run
  [392.00, 0.23],  // G4  8th
  [523.25, 0.23],  // C5  8th
  [659.25, 0.23],  // E5  8th
  [783.99, 0.23],  // G5  8th
  [880.00, 0.46],  // A5  quarter accent
  [783.99, 0.23],  // G5  8th
  [659.25, 0.23],  // E5  8th
  [783.99, 0.46],  // G5  quarter
  // Phrase 3: playful bounce
  [659.25, 0.23],  // E5  8th
  [523.25, 0.23],  // C5  8th
  [659.25, 0.46],  // E5  quarter
  [783.99, 0.23],  // G5  8th
  [659.25, 0.23],  // E5  8th
  [1046.5, 0.46],  // C6  quarter accent
  [783.99, 0.23],  // G5  8th
  [659.25, 0.23],  // E5  8th
  [523.25, 0.69],  // C5  dotted quarter
  // Phrase 4: closing run
  [392.00, 0.23],  // G4  8th
  [523.25, 0.23],  // C5  8th
  [659.25, 0.23],  // E5  8th
  [523.25, 0.23],  // C5  8th
  [659.25, 0.46],  // E5  quarter
  [523.25, 0.92],  // C5  half — resolves
]
// Total ≈ 9.9 s

// ── Duel melody — A natural minor, tense & competitive (~14 s, 128 BPM) ───────
// Relentless forward motion, minor key for friction, brief held notes for drama
const DUEL_MELODY: [number, number][] = [
  // Phrase 1: driving minor
  [440.00, 0.23],  // A4
  [523.25, 0.23],  // C5
  [587.33, 0.47],  // D5  held
  [659.25, 0.23],  // E5
  [587.33, 0.23],  // D5
  [523.25, 0.47],  // C5  held
  [440.00, 0.23],  // A4
  [392.00, 0.47],  // G4  held
  // Phrase 2: tension rise
  [440.00, 0.23],  // A4
  [523.25, 0.23],  // C5
  [659.25, 0.47],  // E5  held
  [783.99, 0.23],  // G5
  [659.25, 0.23],  // E5
  [587.33, 0.47],  // D5  held
  [523.25, 0.23],  // C5
  [440.00, 0.94],  // A4  half — brief breath
  // Phrase 3: descending fury
  [587.33, 0.23],  // D5
  [659.25, 0.23],  // E5
  [587.33, 0.47],  // D5  held
  [523.25, 0.23],  // C5
  [440.00, 0.23],  // A4
  [349.23, 0.47],  // F4  held — darkens
  [392.00, 0.23],  // G4
  [440.00, 0.23],  // A4
  // Phrase 4: power build
  [523.25, 0.47],  // C5  held
  [587.33, 0.23],  // D5
  [523.25, 0.23],  // C5
  [440.00, 0.47],  // A4  held
  [392.00, 0.23],  // G4
  [349.23, 0.23],  // F4
  [392.00, 0.47],  // G4  held
  [440.00, 0.47],  // A4  held
  // Phrase 5: closing
  [349.23, 0.23],  // F4
  [392.00, 0.23],  // G4
  [440.00, 0.23],  // A4
  [523.25, 0.47],  // C5  held
  [440.00, 0.23],  // A4
  [392.00, 0.23],  // G4
  [440.00, 1.00],  // A4  long close
]
// Total ≈ 13.7 s

// ── Boss melody — D natural minor, epic & heavy (~14 s, 108 BPM) ─────────────
// Slower than duel but more imposing; heavy bass, dramatic pauses
const BOSS_MELODY: [number, number][] = [
  // Phrase 1: dark opening
  [293.66, 0.28],  // D4
  [349.23, 0.28],  // F4
  [440.00, 0.56],  // A4  held
  [523.25, 0.28],  // C5
  [440.00, 0.28],  // A4
  [392.00, 0.56],  // G4  held
  [349.23, 0.28],  // F4
  [293.66, 0.83],  // D4  long — weight
  // Phrase 2: building tension
  [261.63, 0.28],  // C4
  [293.66, 0.28],  // D4
  [349.23, 0.56],  // F4  held
  [440.00, 0.28],  // A4
  [493.88, 0.28],  // B4
  [523.25, 0.56],  // C5  held
  [440.00, 0.28],  // A4
  [392.00, 0.56],  // G4  held
  // Phrase 3: dramatic peak
  [349.23, 0.28],  // F4
  [440.00, 0.28],  // A4
  [523.25, 0.56],  // C5  held
  [587.33, 0.28],  // D5  peak
  [523.25, 0.28],  // C5
  [440.00, 0.56],  // A4  held
  [349.23, 0.28],  // F4
  [293.66, 0.83],  // D4  long
  // Phrase 4: brooding close
  [261.63, 0.28],  // C4
  [293.66, 0.28],  // D4
  [349.23, 0.28],  // F4
  [392.00, 0.56],  // G4  held
  [349.23, 0.28],  // F4
  [293.66, 0.28],  // D4
  [261.63, 0.56],  // C4  held
  [293.66, 1.11],  // D4  very long — resolves
]
// Total ≈ 14.1 s

// ── Exports ───────────────────────────────────────────────────────────────────
export const startEncounterLoop = (vol = 0.12): (() => void) =>
  startBattleLoop(ENCOUNTER_MELODY, 130, vol)

export const startDuelLoop = (vol = 0.12): (() => void) =>
  startBattleLoop(DUEL_MELODY, 128, vol)

export const startBossLoop = (vol = 0.12): (() => void) =>
  startBattleLoop(BOSS_MELODY, 108, vol)
