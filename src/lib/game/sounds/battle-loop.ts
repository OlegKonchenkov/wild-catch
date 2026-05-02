/**
 * Battle background music — synthesized via Web Audio API.
 *
 *   startEncounterLoop – wild creature fight (D Dorian, multi-layer, ~6.8 s)
 *   startDuelLoop      – PvP duel (A minor, intense, ~14 s)
 *   startBossLoop      – Boss fight (D minor, epic/heavy, ~14 s)
 *
 * Encounter uses a richer synthesis stack (dual-detuned sawtooth lead,
 * sub-bass, triangle counter-voice, chord stabs, full kit with snare).
 * Duel and boss share the square-wave + kick/hihat engine.
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

// ── Generic loop starter (used by duel & boss) ────────────────────────────────
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
      beatNote(actx, freq, t, dur * 0.88, vol)
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

// ── Encounter-specific synthesis helpers ─────────────────────────────────────

// Dual-detuned sawtooth through lowpass — thick synth lead, not chiptune
function synthLead(ac: AudioContext, freq: number, t: number, dur: number, vol: number): void {
  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'; lpf.frequency.value = 2800; lpf.Q.value = 1.0
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.008)
  g.gain.setValueAtTime(vol, t + dur * 0.78)
  g.gain.linearRampToValueAtTime(0, t + dur)
  lpf.connect(g); g.connect(ac.destination)
  for (const cents of [0, 9]) {
    const o = ac.createOscillator()
    o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = cents
    o.connect(lpf); o.start(t); o.stop(t + dur + 0.02)
  }
}

// Soft triangle voice for harmonic layering / counter-melody
function triVoice(ac: AudioContext, freq: number, t: number, dur: number, vol: number): void {
  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'; lpf.frequency.value = 1600
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06)
  const o = ac.createOscillator()
  o.type = 'triangle'; o.frequency.value = freq
  o.connect(lpf); lpf.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + dur + 0.08)
}

// Sub-bass: sine root + soft 2nd harmonic for warmth
function subBass(ac: AudioContext, freq: number, t: number, dur: number, vol: number): void {
  const g1 = ac.createGain()
  g1.gain.setValueAtTime(0, t)
  g1.gain.linearRampToValueAtTime(vol, t + 0.018)
  g1.gain.setValueAtTime(vol, t + dur * 0.70)
  g1.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06)
  const o1 = ac.createOscillator()
  o1.type = 'sine'; o1.frequency.value = freq
  o1.connect(g1); g1.connect(ac.destination); o1.start(t); o1.stop(t + dur + 0.08)

  const g2 = ac.createGain()
  g2.gain.setValueAtTime(0, t)
  g2.gain.linearRampToValueAtTime(vol * 0.28, t + 0.010)
  g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.45)
  const o2 = ac.createOscillator()
  o2.type = 'triangle'; o2.frequency.value = freq * 2
  o2.connect(g2); g2.connect(ac.destination); o2.start(t); o2.stop(t + dur * 0.5)
}

// Punchy chord stab: sine cluster, percussive decay
function chordStab(ac: AudioContext, freqs: number[], t: number, vol: number): void {
  for (const freq of freqs) {
    const g = ac.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    const o = ac.createOscillator()
    o.type = 'sine'; o.frequency.value = freq
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.24)
  }
}

// Snare: bandpass noise burst + short triangle crack
function snare(ac: AudioContext, t: number, vol: number): void {
  const len = Math.floor(ac.sampleRate * 0.10)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d   = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.2)
  const src = ac.createBufferSource(); src.buffer = buf
  const bpf = ac.createBiquadFilter()
  bpf.type = 'bandpass'; bpf.frequency.value = 1400; bpf.Q.value = 0.7
  const g = ac.createGain(); g.gain.value = vol
  src.connect(bpf); bpf.connect(g); g.connect(ac.destination)
  src.start(t); src.stop(t + 0.12)
  // short crack tone for definition
  const o = ac.createOscillator(); const gc = ac.createGain()
  o.type = 'triangle'; o.frequency.value = 190
  gc.gain.setValueAtTime(vol * 0.5, t)
  gc.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  o.connect(gc); gc.connect(ac.destination); o.start(t); o.stop(t + 0.06)
}

// Open hi-hat: longer highpass noise with gradual fade
function openHat(ac: AudioContext, t: number, vol: number): void {
  const len = Math.floor(ac.sampleRate * 0.10)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d   = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.6)
  const src = ac.createBufferSource(); src.buffer = buf
  const hpf = ac.createBiquadFilter()
  hpf.type = 'highpass'; hpf.frequency.value = 7000
  const g = ac.createGain(); g.gain.value = vol
  src.connect(hpf); hpf.connect(g); g.connect(ac.destination)
  src.start(t); src.stop(t + 0.12)
}

// ── Encounter loop — D Dorian, 142 BPM, 4 bars ≈ 6.76 s ─────────────────────
//
// D Dorian scale: D E F G A B♮ C
// Character: minor feel with a raised 6th (B♮) — "cool" and tense,
// not childish-bright (C major) and not oppressively dark (D minor).
//
// Layers:
//   1. Synth lead    — dual detuned sawtooth + lowpass (thick, wide)
//   2. Counter-voice — soft triangle, sparse harmonic support
//   3. Walking bass  — sine + 2nd harmonic, root-fifth movement
//   4. Chord stabs   — sine cluster, syncopated off-beats ("2 and", "4 and")
//   5. Full kit      — kick 1&3, snare 2&4, 8th hats, open hat on "3 and"
export function startEncounterLoop(vol = 0.12): () => void {
  if (typeof window === 'undefined') return () => {}

  let _ac: AudioContext | null = null
  let stopped = false
  const timers: ReturnType<typeof setTimeout>[] = []

  try {
    _ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
  } catch { return () => {} }
  if (!_ac) return () => {}
  const ac: AudioContext = _ac

  const BEAT     = 60 / 142   // ≈ 0.4225 s per beat
  const E8       = BEAT / 2   // eighth note  ≈ 0.2113 s
  const E16      = BEAT / 4   // sixteenth     ≈ 0.1056 s
  const LOOP_DUR = 16 * BEAT  // 4 bars × 4 beats ≈ 6.76 s

  function onVisibility() {
    if (document.hidden) ac.suspend().catch(() => {})
    else ac.resume().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVisibility)

  // Lead melody: [freq Hz, duration s]
  // 4 bars × 4 beats; each bar sums to exactly 4 × BEAT
  const LEAD: [number, number][] = [
    // Bar 1 — Dm groove (syncopated 16th subdivision for energy)
    [440.00, E8],  [587.33, E16], [659.25, E8],  [587.33, E16],
    [523.25, E8],  [440.00, BEAT],[392.00, E8],  [349.23, E8],
    // Bar 2 — G / Dorian B♮ moment (raised 6th = character note)
    [392.00, E8],  [440.00, E8],  [493.88, BEAT],
    [440.00, E8],  [392.00, E16], [349.23, E16], [392.00, BEAT],
    // Bar 3 — Am7 ascending answer phrase
    [523.25, E8],  [587.33, E8],  [659.25, BEAT],
    [587.33, E8],  [440.00, E16], [392.00, E16], [440.00, BEAT],
    // Bar 4 — descending run resolves back to D
    [349.23, E16], [392.00, E16], [440.00, E8],  [523.25, E8],
    [587.33, E8],  [523.25, E16], [493.88, E16], [440.00, E8],
    [392.00, BEAT],
  ]

  // Walking bass: [freq Hz, duration s]
  // D2=73.42  A2=110.00  G2=98.00  F2=87.31  C3=130.81
  const BASS: [number, number][] = [
    // Bar 1: D root pump
    [73.42, BEAT],  [73.42, E8],   [110.00, E8],
    [73.42, E8],    [73.42, E8],   [110.00, BEAT],
    // Bar 2: G bass with passing F
    [98.00, BEAT],  [98.00, E8],   [87.31,  E8],
    [98.00, E8],    [98.00, E8],   [98.00,  BEAT],
    // Bar 3: A bass (Am feel)
    [110.00, BEAT], [110.00, E8],  [130.81, E8],
    [110.00, E8],   [110.00, E8],  [110.00, BEAT],
    // Bar 4: F → G → D cadence
    [87.31, E8],    [98.00, E8],   [73.42, BEAT],
    [87.31, E8],    [98.00, E8],   [73.42, BEAT],
  ]

  // Counter-melody notes: [freq Hz, time offset from bar start s, duration s]
  // Sparse — adds harmonic depth without cluttering the lead
  const COUNTER: [number, number, number][] = [
    [659.25, 0,               E8 * 2],       // bar 1 beat 1
    [783.99, BEAT,            BEAT],          // bar 1 beat 2
    [587.33, BEAT * 4 + E8,  BEAT + E8],     // bar 2 after beat 1
    [523.25, BEAT * 6,        BEAT],          // bar 2 beat 3
    [783.99, BEAT * 8,        BEAT],          // bar 3 beat 1
    [659.25, BEAT * 10,       BEAT],          // bar 3 beat 3
    [523.25, BEAT * 12,       E8],            // bar 4 beat 1
    [587.33, BEAT * 12 + E8,  E8],            // bar 4 beat 1 "and"
    [659.25, BEAT * 13,       E8],            // bar 4 beat 2
    [783.99, BEAT * 13 + E8,  E8],            // bar 4 beat 2 "and"
    [659.25, BEAT * 15,       BEAT],          // bar 4 beat 4 (finishes on loop boundary)
  ]

  // Chord stabs on "and" of beats 2 & 4 (syncopated → not childish)
  // [freqs Hz[], beat position in loop]
  const STABS: [number[], number][] = [
    [[293.66, 349.23, 440.00, 523.25],  1.5],  // Dm7   bar 1 "2 and"
    [[293.66, 349.23, 440.00, 523.25],  3.5],  // Dm7   bar 1 "4 and"
    [[392.00, 493.88, 587.33],           5.5],  // G     bar 2 "2 and"
    [[392.00, 493.88, 587.33],           7.5],  // G     bar 2 "4 and"
    [[440.00, 523.25, 659.25],           9.5],  // Am    bar 3 "2 and"
    [[440.00, 523.25, 659.25],          11.5],  // Am    bar 3 "4 and"
    [[349.23, 440.00, 523.25, 659.25],  13.5],  // Fmaj7 bar 4 "2 and"
    [[392.00, 493.88, 587.33],          15.5],  // G     bar 4 "4 and" (pickup to repeat)
  ]

  function scheduleLoop(t0: number): void {
    if (stopped) return

    // Lead (sawtooth dual-detuned, lowpass filtered)
    let lt = t0
    for (const [f, d] of LEAD) { synthLead(ac, f, lt, d * 0.80, vol * 0.22); lt += d }

    // Counter-melody (sparse triangle harmonics)
    for (const [f, off, d] of COUNTER) { triVoice(ac, f, t0 + off, d * 0.85, vol * 0.13) }

    // Bass (sub-sine + warm 2nd harmonic)
    let bt = t0
    for (const [f, d] of BASS) { subBass(ac, f, bt, d * 0.82, vol * 0.48); bt += d }

    // Syncopated chord stabs
    for (const [freqs, beat] of STABS) { chordStab(ac, freqs, t0 + beat * BEAT, vol * 0.10) }

    // Full drum kit — 4 bars
    for (let bar = 0; bar < 4; bar++) {
      const b0 = t0 + bar * BEAT * 4
      kick(ac, b0,              vol * 2.2)            // beat 1
      kick(ac, b0 + BEAT * 2,   vol * 1.8)            // beat 3
      if (bar === 1) kick(ac, b0 + BEAT * 3.75, vol * 1.2)  // ghost synco pre-4
      snare(ac, b0 + BEAT,      vol * 1.4)             // beat 2
      snare(ac, b0 + BEAT * 3,  vol * 1.4)             // beat 4
      for (let i = 0; i < 8; i++) {
        const ht = b0 + i * E8
        if (i === 6) openHat(ac, ht, vol * 0.9)       // open hat on "3 and"
        else hihat(ac, ht, vol * (i % 2 === 0 ? 1.0 : 0.65))
      }
    }

    const msUntilNext = Math.max(50, (LOOP_DUR - 1.0) * 1000)
    const timer = setTimeout(() => scheduleLoop(t0 + LOOP_DUR), msUntilNext)
    timers.push(timer)
  }
  scheduleLoop(ac.currentTime + 0.5)

  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    timers.forEach(clearTimeout)
    ac.close().catch(() => {})
  }
}

// ── Duel melody — A natural minor, tense & competitive (~14 s, 128 BPM) ───────
const DUEL_MELODY: [number, number][] = [
  [440.00, 0.23],  [523.25, 0.23],  [587.33, 0.47],
  [659.25, 0.23],  [587.33, 0.23],  [523.25, 0.47],
  [440.00, 0.23],  [392.00, 0.47],
  [440.00, 0.23],  [523.25, 0.23],  [659.25, 0.47],
  [783.99, 0.23],  [659.25, 0.23],  [587.33, 0.47],
  [523.25, 0.23],  [440.00, 0.94],
  [587.33, 0.23],  [659.25, 0.23],  [587.33, 0.47],
  [523.25, 0.23],  [440.00, 0.23],  [349.23, 0.47],
  [392.00, 0.23],  [440.00, 0.23],
  [523.25, 0.47],  [587.33, 0.23],  [523.25, 0.23],
  [440.00, 0.47],  [392.00, 0.23],  [349.23, 0.23],
  [392.00, 0.47],  [440.00, 0.47],
  [349.23, 0.23],  [392.00, 0.23],  [440.00, 0.23],
  [523.25, 0.47],  [440.00, 0.23],  [392.00, 0.23],
  [440.00, 1.00],
]

// ── Boss melody — D natural minor, epic & heavy (~14 s, 108 BPM) ─────────────
const BOSS_MELODY: [number, number][] = [
  [293.66, 0.28],  [349.23, 0.28],  [440.00, 0.56],
  [523.25, 0.28],  [440.00, 0.28],  [392.00, 0.56],
  [349.23, 0.28],  [293.66, 0.83],
  [261.63, 0.28],  [293.66, 0.28],  [349.23, 0.56],
  [440.00, 0.28],  [493.88, 0.28],  [523.25, 0.56],
  [440.00, 0.28],  [392.00, 0.56],
  [349.23, 0.28],  [440.00, 0.28],  [523.25, 0.56],
  [587.33, 0.28],  [523.25, 0.28],  [440.00, 0.56],
  [349.23, 0.28],  [293.66, 0.83],
  [261.63, 0.28],  [293.66, 0.28],  [349.23, 0.28],
  [392.00, 0.56],  [349.23, 0.28],  [293.66, 0.28],
  [261.63, 0.56],  [293.66, 1.11],
]

// ── Exports ───────────────────────────────────────────────────────────────────
export const startDuelLoop  = (vol = 0.12): (() => void) =>
  startBattleLoop(DUEL_MELODY,  128, vol)

export const startBossLoop  = (vol = 0.12): (() => void) =>
  startBattleLoop(BOSS_MELODY,  108, vol)
