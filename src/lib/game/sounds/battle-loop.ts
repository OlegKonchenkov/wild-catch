/**
 * Battle background music — synthesized via Web Audio API, mastered through
 * the shared bus chain. Three loops with distinct moods:
 *
 *   startEncounterLoop  – wild creature fight (D Dorian, ~6.8 s, energetic
 *                          modern-cinematic with full kit + side-chain pump)
 *   startDuelLoop       – PvP duel (A minor, ~14 s, percussive arena feel
 *                          with chord stabs + sub bass)
 *   startBossLoop       – Boss fight (D minor, ~14 s, epic with pad bed,
 *                          timpani fills, tension-sweep build-ups, cathedral
 *                          reverb on the lead)
 *
 * Routing per loop:
 *   sources → duckGain → master bus
 *   pad/lead reverb → duckGain → master bus
 *
 * The duckGain serves two purposes:
 *   (a) future hooks for ducking via shared-ac SFX bursts (parity with map)
 *   (b) side-chain target for kick-driven pumping on pad/lead via schedulePump
 *
 * Visibility handling unchanged: AC suspends when tab hidden.
 */

import { newAudioContext } from './shared-ac'
import { getAudioOverride, type AudioSlot } from '../audio-overrides'
import { isMusicMuted } from '@/lib/audioPrefs'
import { startSampleLoop } from './sample-loop'
import { getMasterBus } from './master-bus'
import { createReverb } from './procedural-reverb'
import { pad } from './synths'
import { kick, snare, hihat, tom, schedulePump } from './drums'

/**
 * Admin override path: if a custom mp3 is configured for the slot, return a
 * stop function for it; otherwise null and the synth path runs.
 */
function tryStartOverride(slot: AudioSlot, vol: number): (() => void) | null {
  const url = getAudioOverride(slot)
  if (!url) return null
  return startSampleLoop(url, { volume: Math.max(0.1, vol * 3) })
}

// ── Synth voices ──────────────────────────────────────────────────────────────

/**
 * "Supersaw" lead: 3 sawtooth voices detuned (-12, 0, +12 cents) through a
 * lowpass filter, plus an octave-down sine for body. Thick analog feel.
 */
function synthLeadSaw(
  ac: AudioContext,
  freq: number, t: number, dur: number, vol: number,
  dest: AudioNode,
): void {
  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'; lpf.frequency.value = 3000; lpf.Q.value = 1.1
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.008)
  g.gain.setValueAtTime(vol, t + dur * 0.78)
  g.gain.linearRampToValueAtTime(0, t + dur)
  lpf.connect(g); g.connect(dest)

  for (const cents of [-12, 0, 12]) {
    const o = ac.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = freq; o.detune.value = cents
    o.connect(lpf); o.start(t); o.stop(t + dur + 0.02)
  }

  // Sub-octave sine for body
  const sub = ac.createOscillator()
  const subG = ac.createGain()
  sub.type = 'sine'; sub.frequency.value = freq * 0.5
  subG.gain.setValueAtTime(0, t)
  subG.gain.linearRampToValueAtTime(vol * 0.38, t + 0.010)
  subG.gain.setValueAtTime(vol * 0.38, t + dur * 0.72)
  subG.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.04)
  sub.connect(subG); subG.connect(dest)
  sub.start(t); sub.stop(t + dur + 0.05)
}

/**
 * "Beat-square" lead for duel/boss: 2 square voices at ±7 cents through a
 * lowpass + sub-octave sine for body. Retro-game feel but with weight.
 */
function beatNote(
  ac: AudioContext,
  freq: number, t: number, dur: number, vol: number,
  dest: AudioNode,
): void {
  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'; lpf.frequency.value = 2400; lpf.Q.value = 1.0
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol * 0.18, t + 0.008)
  g.gain.setValueAtTime(vol * 0.18, t + dur * 0.72)
  g.gain.linearRampToValueAtTime(0, t + dur)
  lpf.connect(g); g.connect(dest)

  for (const cents of [-7, 7]) {
    const o = ac.createOscillator()
    o.type = 'square'; o.frequency.value = freq; o.detune.value = cents
    o.connect(lpf); o.start(t); o.stop(t + dur + 0.01)
  }

  // Sub-octave sine — gives the square lead a body it doesn't have on its own
  const sub  = ac.createOscillator()
  const subG = ac.createGain()
  sub.type = 'sine'; sub.frequency.value = freq * 0.5
  subG.gain.setValueAtTime(0, t)
  subG.gain.linearRampToValueAtTime(vol * 0.14, t + 0.010)
  subG.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06)
  sub.connect(subG); subG.connect(dest)
  sub.start(t); sub.stop(t + dur + 0.08)
}

/** Soft triangle counter-melody voice with lowpass — sits behind the lead. */
function triVoice(
  ac: AudioContext,
  freq: number, t: number, dur: number, vol: number,
  dest: AudioNode,
): void {
  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'; lpf.frequency.value = 1600
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06)
  const o = ac.createOscillator()
  o.type = 'triangle'; o.frequency.value = freq
  o.connect(lpf); lpf.connect(g); g.connect(dest)
  o.start(t); o.stop(t + dur + 0.08)
}

/** Sub-bass: sine root + warm 2nd harmonic. */
function subBass(
  ac: AudioContext,
  freq: number, t: number, dur: number, vol: number,
  dest: AudioNode,
): void {
  const g1 = ac.createGain()
  g1.gain.setValueAtTime(0, t)
  g1.gain.linearRampToValueAtTime(vol, t + 0.018)
  g1.gain.setValueAtTime(vol, t + dur * 0.70)
  g1.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06)
  const o1 = ac.createOscillator()
  o1.type = 'sine'; o1.frequency.value = freq
  o1.connect(g1); g1.connect(dest); o1.start(t); o1.stop(t + dur + 0.08)

  const g2 = ac.createGain()
  g2.gain.setValueAtTime(0, t)
  g2.gain.linearRampToValueAtTime(vol * 0.30, t + 0.010)
  g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.45)
  const o2 = ac.createOscillator()
  o2.type = 'triangle'; o2.frequency.value = freq * 2
  o2.connect(g2); g2.connect(dest); o2.start(t); o2.stop(t + dur * 0.5)
}

/** Punchy chord stab: sine cluster, percussive decay. */
function chordStab(
  ac: AudioContext,
  freqs: number[], t: number, vol: number,
  dest: AudioNode,
): void {
  for (const freq of freqs) {
    const g = ac.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
    const o = ac.createOscillator()
    o.type = 'sine'; o.frequency.value = freq
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.26)
  }
}

/**
 * Tension sweep — bandpass noise with rising centre frequency over a long
 * window. Used in boss loop to build drama leading into each bar 1.
 */
function tensionSweep(
  ac: AudioContext,
  t: number, durS: number, vol: number,
  dest: AudioNode,
): void {
  const len = Math.floor(ac.sampleRate * (durS + 0.2))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  const bpf = ac.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.setValueAtTime(200, t)
  bpf.frequency.exponentialRampToValueAtTime(6000, t + durS)
  bpf.Q.value = 1.2
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol * 0.32, t + durS * 0.65)
  g.gain.exponentialRampToValueAtTime(0.001, t + durS + 0.05)
  src.connect(bpf); bpf.connect(g); g.connect(dest)
  src.start(t); src.stop(t + durS + 0.1)
}

// ── Encounter loop — D Dorian, 142 BPM, 4 bars ≈ 6.76 s ─────────────────────
//
// D Dorian: D E F G A B♮ C — minor feel with raised 6th, "cool" not childish.
//
// Layers (all routed through duckGain → master bus):
//   1. Lead supersaw  – 3-voice detuned + sub-octave sine
//   2. Counter triv.  – soft triangle harmonics (sparse), small reverb
//   3. Walking bass   – sub-sine + warm 2nd harmonic
//   4. Chord stabs    – sine cluster on syncopated off-beats, small reverb
//   5. Full kit       – multi-layer kick (1&3) + snare (2&4) + 8th hats
//                       + open hat on "3 and"
//   6. Side-chain     – pad-stab gain ducks 30% under each kick (pump feel)
export function startEncounterLoop(vol = 0.12): () => void {
  if (typeof window === 'undefined') return () => {}
  if (isMusicMuted()) return () => {}

  const override = tryStartOverride('encounter', vol)
  if (override) return override

  let _ac: AudioContext | null = null
  let stopped = false
  const timers: ReturnType<typeof setTimeout>[] = []

  _ac = newAudioContext()
  if (!_ac) return () => {}
  const ac: AudioContext = _ac

  // Mastering routing
  const duckGain = ac.createGain()
  duckGain.gain.value = 1.0
  duckGain.connect(getMasterBus(ac))
  const reverbSmall = createReverb(ac, 'small', duckGain)

  // Side-chain bus for pad/counter/stabs — kick pumps this gain so layers
  // breathe under the drums (cinematic / modern game feel)
  const sideChain = ac.createGain()
  sideChain.gain.value = 1.0
  sideChain.connect(duckGain)
  const sideChainWithReverb = ac.createGain()
  sideChainWithReverb.gain.value = 1.0
  sideChainWithReverb.connect(reverbSmall)

  const BEAT     = 60 / 142   // ≈ 0.4225 s per beat
  const E8       = BEAT / 2   // eighth note
  const E16      = BEAT / 4   // sixteenth
  const LOOP_DUR = 16 * BEAT  // 4 bars × 4 beats ≈ 6.76 s

  function onVisibility() {
    if (document.hidden) ac.suspend().catch(() => {})
    else ac.resume().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVisibility)

  // Lead melody: [freq Hz, duration s] — 4 bars × 4 beats
  const LEAD: [number, number][] = [
    // Bar 1 — Dm groove
    [440.00, E8],  [587.33, E16], [659.25, E8],  [587.33, E16],
    [523.25, E8],  [440.00, BEAT],[392.00, E8],  [349.23, E8],
    // Bar 2 — G / Dorian B♮ moment
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

  const BASS: [number, number][] = [
    [73.42, BEAT],  [73.42, E8],   [110.00, E8],
    [73.42, E8],    [73.42, E8],   [110.00, BEAT],
    [98.00, BEAT],  [98.00, E8],   [87.31,  E8],
    [98.00, E8],    [98.00, E8],   [98.00,  BEAT],
    [110.00, BEAT], [110.00, E8],  [130.81, E8],
    [110.00, E8],   [110.00, E8],  [110.00, BEAT],
    [87.31, E8],    [98.00, E8],   [73.42, BEAT],
    [87.31, E8],    [98.00, E8],   [73.42, BEAT],
  ]

  const COUNTER: [number, number, number][] = [
    [659.25, 0,               E8 * 2],
    [783.99, BEAT,            BEAT],
    [587.33, BEAT * 4 + E8,  BEAT + E8],
    [523.25, BEAT * 6,        BEAT],
    [783.99, BEAT * 8,        BEAT],
    [659.25, BEAT * 10,       BEAT],
    [523.25, BEAT * 12,       E8],
    [587.33, BEAT * 12 + E8,  E8],
    [659.25, BEAT * 13,       E8],
    [783.99, BEAT * 13 + E8,  E8],
    [659.25, BEAT * 15,       BEAT],
  ]

  const STABS: [number[], number][] = [
    [[293.66, 349.23, 440.00, 523.25],  1.5],
    [[293.66, 349.23, 440.00, 523.25],  3.5],
    [[392.00, 493.88, 587.33],           5.5],
    [[392.00, 493.88, 587.33],           7.5],
    [[440.00, 523.25, 659.25],           9.5],
    [[440.00, 523.25, 659.25],          11.5],
    [[349.23, 440.00, 523.25, 659.25],  13.5],
    [[392.00, 493.88, 587.33],          15.5],
  ]

  function scheduleLoop(t0: number): void {
    if (stopped) return

    // Lead → duckGain (dry, in front)
    let lt = t0
    for (const [f, d] of LEAD) { synthLeadSaw(ac, f, lt, d * 0.80, vol * 0.22, duckGain); lt += d }

    // Counter-melody → sideChainWithReverb → reverbSmall (pumps + ambient)
    for (const [f, off, d] of COUNTER) { triVoice(ac, f, t0 + off, d * 0.85, vol * 0.13, sideChainWithReverb) }

    // Bass → duckGain (dry, anchored)
    let bt = t0
    for (const [f, d] of BASS) { subBass(ac, f, bt, d * 0.82, vol * 0.48, duckGain); bt += d }

    // Chord stabs → sideChainWithReverb (pumps with kicks)
    for (const [freqs, beat] of STABS) { chordStab(ac, freqs, t0 + beat * BEAT, vol * 0.10, sideChainWithReverb) }

    // Full drum kit — 4 bars, all dry through duckGain
    for (let bar = 0; bar < 4; bar++) {
      const b0 = t0 + bar * BEAT * 4
      const kickHits = [b0, b0 + BEAT * 2]            // beats 1 & 3
      if (bar === 1) kickHits.push(b0 + BEAT * 3.75)  // ghost synco pre-4

      for (const kt of kickHits) {
        kick(ac, kt, vol * 1.6, duckGain)
        // Pump the side-chain bus (pad/counter/stabs duck under kick)
        schedulePump(sideChain, ac, kt, 0.32, 0.16)
        schedulePump(sideChainWithReverb, ac, kt, 0.32, 0.16)
      }

      snare(ac, b0 + BEAT,     vol * 0.95, duckGain)  // beat 2
      snare(ac, b0 + BEAT * 3, vol * 0.95, duckGain)  // beat 4
      for (let i = 0; i < 8; i++) {
        const ht = b0 + i * E8
        if (i === 6) hihat(ac, ht, vol * 0.55, duckGain, true)
        else         hihat(ac, ht, vol * (i % 2 === 0 ? 0.55 : 0.35), duckGain, false)
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

// ── Shared duel/boss engine ─────────────────────────────────────────────────

interface BattleLoopConfig {
  melody:     [number, number][]
  bpm:        number
  vol:        number
  /** Sub-bass walking pattern: [freq, duration] pairs covering the loop. */
  bass:       [number, number][]
  /** Chord stab pattern: [freqs, beatOffset]. Optional. */
  stabs?:     [number[], number][]
  /** Sustained pad chord across the loop (boss only). null/undef = no pad. */
  padChord?:  number[] | null
  /** Add a tension sweep across the loop (boss only). */
  tensionSweep?: boolean
  /** Add timpani fills every 4 beats from this beat (boss only). */
  timpaniEveryBars?: number  // e.g. 4 → fill at end of every 4 bars
  /** Use cathedral reverb on the lead instead of small (boss only). */
  cathedral?: boolean
  /** Lead voice: which timbre to use. */
  leadVoice:  'saw' | 'square'
  /** Side-chain pump depth (0..1). */
  pumpDepth?: number
}

function startBattleLoop(cfg: BattleLoopConfig): () => void {
  if (typeof window === 'undefined') return () => {}

  const ac = newAudioContext()
  let stopped = false
  const timers: ReturnType<typeof setTimeout>[] = []

  if (!ac) return () => {}
  const actx: AudioContext = ac

  const duckGain = actx.createGain()
  duckGain.gain.value = 1.0
  duckGain.connect(getMasterBus(actx))
  const leadReverb = createReverb(actx, cfg.cathedral ? 'cathedral' : 'small', duckGain)
  const padReverb  = createReverb(actx, 'small', duckGain)

  // Side-chain bus — pad/stabs pump under the kick
  const sideChain = actx.createGain()
  sideChain.gain.value = 1.0
  sideChain.connect(duckGain)
  const sideChainWithPadReverb = actx.createGain()
  sideChainWithPadReverb.gain.value = 1.0
  sideChainWithPadReverb.connect(padReverb)

  const loopDur = cfg.melody.reduce((s, [, d]) => s + d, 0)
  const beatDur = 60 / cfg.bpm

  function onVisibility() {
    if (document.hidden) actx.suspend().catch(() => {})
    else actx.resume().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVisibility)

  function scheduleLoop(startTime: number): void {
    if (stopped) return

    // Lead — saw or square, routed through reverb (small or cathedral)
    let t = startTime
    for (const [freq, dur] of cfg.melody) {
      if (cfg.leadVoice === 'saw') {
        synthLeadSaw(actx, freq, t, dur * 0.86, cfg.vol * 0.22, leadReverb)
      } else {
        beatNote(actx, freq, t, dur * 0.88, cfg.vol, leadReverb)
      }
      t += dur
    }

    // Walking bass — dry, anchored
    let bt = startTime
    for (const [freq, dur] of cfg.bass) {
      subBass(actx, freq, bt, dur * 0.82, cfg.vol * 0.50, duckGain)
      bt += dur
    }

    // Pad bed (boss) — D minor sustained, with side-chain pumping under kicks
    if (cfg.padChord) {
      pad(actx, cfg.padChord, startTime, loopDur, cfg.vol * 0.20, sideChainWithPadReverb)
    }

    // Chord stabs
    if (cfg.stabs) {
      for (const [freqs, beat] of cfg.stabs) {
        chordStab(actx, freqs, startTime + beat * beatDur, cfg.vol * 0.10, sideChainWithPadReverb)
      }
    }

    // Tension sweep — runs the full loop length, peaks near the end
    if (cfg.tensionSweep) {
      tensionSweep(actx, startTime, loopDur * 0.92, cfg.vol * 1.2, duckGain)
    }

    // Drum kit — kick on 1 & 3, snare on 2 & 4, 8th hats, open hat on "3 and"
    const totalBeats = Math.floor(loopDur / beatDur)
    const pumpDepth = cfg.pumpDepth ?? 0.30
    for (let i = 0; i < totalBeats; i++) {
      const tb = startTime + i * beatDur
      const beatInBar = i % 4
      if (beatInBar === 0 || beatInBar === 2) {
        kick(actx, tb, cfg.vol * 1.6, duckGain)
        schedulePump(sideChain, actx, tb, pumpDepth, beatDur * 0.45)
        schedulePump(sideChainWithPadReverb, actx, tb, pumpDepth, beatDur * 0.45)
      }
      if (beatInBar === 1 || beatInBar === 3) {
        snare(actx, tb, cfg.vol * 0.90, duckGain)
      }
      // 8th hats: closed on every half-beat except "3 and" (open hat)
      hihat(actx, tb,              cfg.vol * 0.45, duckGain, false)
      const openHere = (beatInBar === 2)  // "3 and" → open
      hihat(actx, tb + beatDur / 2, cfg.vol * (openHere ? 0.50 : 0.30), duckGain, openHere)
    }

    // Timpani fill — boss only, at the end of every N bars
    if (cfg.timpaniEveryBars) {
      const fillEvery = cfg.timpaniEveryBars * 4 * beatDur
      let fillT = startTime + fillEvery - beatDur * 1.5  // pickup of last bar
      while (fillT < startTime + loopDur - beatDur * 0.25) {
        // 3-tom fill: descending pitch, ending on a low boom
        tom(actx, fillT,              280, cfg.vol * 1.0, duckGain)
        tom(actx, fillT + beatDur * 0.5, 220, cfg.vol * 1.0, duckGain)
        tom(actx, fillT + beatDur,    160, cfg.vol * 1.3, duckGain)
        fillT += fillEvery
      }
    }

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

// Walking bass under the duel melody — Am-Dm-G-E progression-ish
// A2=110, D2=73.42, G2=98, E2=82.41
const DUEL_BASS: [number, number][] = [
  [110.00, 0.94], [110.00, 0.47], [82.41, 0.47],
  [110.00, 0.94], [110.00, 0.47], [82.41, 0.47],
  [73.42, 0.94],  [73.42, 0.47],  [98.00, 0.47],
  [73.42, 0.94],  [73.42, 0.47],  [98.00, 0.47],
  [98.00, 0.94],  [98.00, 0.47],  [110.00, 0.47],
  [98.00, 0.94],  [82.41, 0.94],
  [110.00, 0.94], [82.41, 0.47],  [98.00, 0.47],
  [110.00, 1.88],
]

// Chord stabs on syncopated "and" of beats — gives the duel its arena pulse
// (beatDur at 128 BPM = 0.469s; stab positions are in beats from loop start)
const DUEL_STABS: [number[], number][] = [
  [[220.00, 261.63, 329.63],  1.5],   // Am  bar 1 "2 and"
  [[220.00, 261.63, 329.63],  3.5],   // Am  bar 1 "4 and"
  [[146.83, 220.00, 349.23],  5.5],   // Dm
  [[146.83, 220.00, 349.23],  7.5],   // Dm
  [[196.00, 246.94, 392.00],  9.5],   // G
  [[196.00, 246.94, 392.00], 11.5],   // G
  [[164.81, 220.00, 329.63], 13.5],   // Am (resolves back)
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

// Boss bass — heavy D pedal with occasional ascending tension
// D2=73.42, A2=110, F2=87.31, Bb2=116.54
const BOSS_BASS: [number, number][] = [
  [73.42, 1.11],  [73.42, 0.83],  [87.31, 0.56],
  [73.42, 1.11],  [73.42, 0.83],  [110.00, 0.56],
  [87.31, 1.11],  [98.00, 0.83],  [73.42, 0.56],
  [73.42, 1.11],  [110.00, 0.83], [116.54, 0.56],
  [98.00, 1.11],  [87.31, 0.83],  [73.42, 1.39],
]

// Boss pad chord — Dm9 (D F A C E) — dark and orchestral
const BOSS_PAD = [73.42, 87.31, 110.00, 130.81, 164.81]

// ── Exports ───────────────────────────────────────────────────────────────────
export const startDuelLoop = (vol = 0.12): (() => void) =>
  tryStartOverride('duel', vol) ?? startBattleLoop({
    melody:     DUEL_MELODY,
    bass:       DUEL_BASS,
    stabs:      DUEL_STABS,
    bpm:        128,
    vol,
    leadVoice:  'square',
    pumpDepth:  0.28,
  })

export const startBossLoop = (vol = 0.12): (() => void) =>
  tryStartOverride('boss', vol) ?? startBattleLoop({
    melody:           BOSS_MELODY,
    bass:             BOSS_BASS,
    bpm:              108,
    vol:              vol * 1.05,  // boss runs a touch louder for impact
    leadVoice:        'square',
    padChord:         BOSS_PAD,
    tensionSweep:     true,
    timpaniEveryBars: 4,
    cathedral:        true,
    pumpDepth:        0.40,
  })
