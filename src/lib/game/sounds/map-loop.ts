/**
 * Map background ambience — "borgo all'alba" feel.
 *
 * Loop structure (G major pentatonic, ~21 s):
 *   1. Pluck melody   – Karplus-Strong plucked string (mandolino/chitarra),
 *                       wide stereo via Haas delay
 *   2. Counter-voice  – soft sine echoes through CATHEDRAL reverb
 *                       (distant, ethereal)
 *   3. Pizzicato bass – sine + 2nd harmonic, dry, anchored centre
 *   4. Pad bed        – sustained Gmaj7 chord under everything, SMALL reverb,
 *                       LFO-modulated lowpass for movement
 *   5. FM bell chimes – metallic glockenspiel timbre, SMALL reverb,
 *                       random every 6–18 s
 *   6. Bird call      – occasional chirp every 12–28 s
 *
 * Signal flow:
 *   sources → duckGain → master bus
 *   reverb sends → duckGain → master bus  (so duck affects wet tails too)
 *
 * Ducking API preserved:
 *   duckMapAmbience(duckTo?, rampMs?)
 *   unduckMapAmbience(rampMs?)
 */

import { newAudioContext } from './shared-ac'
import { getAudioOverride } from '../audio-overrides'
import { isMusicMuted } from '@/lib/audioPrefs'
import { startSampleLoop } from './sample-loop'
import { getMasterBus } from './master-bus'
import { createReverb } from './procedural-reverb'
import { pluckString, pad, fmBell, haasWidth } from './synths'

// ── Melody data ────────────────────────────────────────────────────────────────
// G major pentatonic: G4=392 A4=440 B4=493.88 D5=587.33 E5=659.25 G5=783.99
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

const COUNTER: [number, number, number][] = [
  [4.40, 1174.66, 0.60],
  [4.40, 1318.51, 0.45],
  [10.00, 1567.98, 0.55],
  [10.00, 1318.51, 0.40],
  [15.55, 1567.98, 0.65],
  [15.55, 1975.53, 0.45],
  [15.55, 1318.51, 0.50],
]

const BASS: [number, number, number][] = [
  [0.0,  97.999, 0.65],
  [4.95, 97.999, 0.65],
  [9.95, 73.416, 0.70],
  [15.6, 97.999, 0.65],
  [18.5, 110.00, 0.55],
]

// Gmaj7 chord for the sustained pad bed: G2 D3 G3 B3 D4 F#4
const PAD_CHORD = [97.999, 146.832, 195.998, 246.94, 293.66, 369.99]

// ── Counter-voice (soft sine echo, used via reverb cathedral) ─────────────────
function scheduleCounter(ac: AudioContext, dest: AudioNode, freq: number, t: number, dur: number, vol: number): void {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol * 0.18, t + 0.010)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(dest)
  o.start(t); o.stop(t + dur + 0.03)
}

// ── Bass (pizzicato sine + 2nd harmonic) ──────────────────────────────────────
function scheduleBass(ac: AudioContext, dest: AudioNode, freq: number, t: number, dur: number, vol: number): void {
  // Fundamental
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(vol * 0.28, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(dest)
  o.start(t); o.stop(t + dur + 0.05)

  // 2nd harmonic for warmth — softer and shorter
  const o2 = ac.createOscillator()
  const g2 = ac.createGain()
  o2.type = 'triangle'; o2.frequency.value = freq * 2
  g2.gain.setValueAtTime(vol * 0.07, t)
  g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.5)
  o2.connect(g2); g2.connect(dest)
  o2.start(t); o2.stop(t + dur * 0.55)
}

// ── Module-level state for ducking ─────────────────────────────────────────────
let _master:   GainNode    | null = null
let _masterAC: AudioContext | null = null

export function duckMapAmbience(duckTo = 0.08, rampMs = 350): void {
  if (!_master || !_masterAC) return
  const now = _masterAC.currentTime
  _master.gain.cancelScheduledValues(now)
  _master.gain.setValueAtTime(_master.gain.value, now)
  _master.gain.linearRampToValueAtTime(duckTo, now + rampMs / 1000)
}

export function unduckMapAmbience(rampMs = 900): void {
  if (!_master || !_masterAC) return
  const now = _masterAC.currentTime
  _master.gain.cancelScheduledValues(now)
  _master.gain.setValueAtTime(_master.gain.value, now)
  _master.gain.linearRampToValueAtTime(1.0, now + rampMs / 1000)
}

// ── Main ambience start ────────────────────────────────────────────────────────
export function startMapAmbience(vol = 0.12): () => void {
  if (typeof window === 'undefined') return () => {}
  if (isMusicMuted()) return () => {}

  // Admin-uploaded override: bypass the synth path and play the file in loop.
  const override = getAudioOverride('map')
  if (override) return startSampleLoop(override, { volume: Math.max(0.1, vol * 3) })

  const ac = newAudioContext()
  let stopped = false
  const timers: ReturnType<typeof setTimeout>[] = []

  if (!ac) return () => {}
  const actx: AudioContext = ac

  // Duck-gain sits in front of the master bus. Reverb sends and dry sources
  // all feed into it, so duckMapAmbience smoothly dims wet tails together
  // with dry signal — no awkward "reverb keeps blaring under modal" moment.
  const duckGain = actx.createGain()
  duckGain.gain.value = 1.0
  duckGain.connect(getMasterBus(actx))
  _master   = duckGain
  _masterAC = actx

  // Reverb sends — built once for the lifetime of the loop, then shared
  const reverbSmall     = createReverb(actx, 'small',     duckGain)
  const reverbCathedral = createReverb(actx, 'cathedral', duckGain)

  // Pad bus: dry to duckGain + tiny send to small reverb. Pad needs dry
  // presence as the foundation — was wet-only before which made it wash.
  const padBus = actx.createGain(); padBus.gain.value = 1.0
  padBus.connect(duckGain)
  const padReverbSend = actx.createGain(); padReverbSend.gain.value = 0.30
  padBus.connect(padReverbSend)
  padReverbSend.connect(reverbSmall)

  // Stereo widener for the melody — Haas effect at 14 ms / ±0.55 pan
  // Routes to duckGain (dry path, no reverb on melody — it's the focal voice)
  const melodyWidener = haasWidth(actx, duckGain, 14, 0.55)

  function onVisibility() {
    if (document.hidden) actx.suspend().catch(() => {})
    else actx.resume().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVisibility)

  function scheduleMelodyLoop(startTime: number): void {
    if (stopped) return

    // Melody — Karplus-Strong plucked string through stereo widener
    let t = startTime
    for (const [freq, dur] of MELODY) {
      pluckString(actx, freq, t, dur * 0.92, vol * 1.05, melodyWidener.input)
      t += dur
    }

    // Counter-voice — sine through cathedral reverb (distant, ethereal)
    for (const [offset, freq, dur] of COUNTER) {
      scheduleCounter(actx, reverbCathedral, freq, startTime + offset, dur, vol)
    }

    // Bass — dry, anchored centre
    for (const [offset, freq, dur] of BASS) {
      scheduleBass(actx, duckGain, freq, startTime + offset, dur, vol)
    }

    // Pad bed — Gmaj7 sustained across the whole loop, dry-heavy + tiny reverb
    // Lower volume than melody so the pluck stays in front
    pad(actx, PAD_CHORD, startTime, LOOP_DUR, vol * 0.18, padBus)

    const msUntilNext = Math.max(50, (LOOP_DUR - 1.0) * 1000)
    const timer = setTimeout(() => scheduleMelodyLoop(startTime + LOOP_DUR), msUntilNext)
    timers.push(timer)
  }
  scheduleMelodyLoop(actx.currentTime + 0.4)

  // G pentatonic chime notes for the random sparkles
  const chimeNotes = [392.00, 493.88, 587.33, 659.25, 783.99, 880.00, 1046.5, 1318.5, 1567.98]

  function scheduleChime(): void {
    if (stopped) return
    const delay = 6000 + Math.random() * 12000
    const t = setTimeout(() => {
      if (stopped) return
      const now  = actx.currentTime
      const base = Math.floor(Math.random() * (chimeNotes.length - 3))
      const cnt  = 2 + Math.floor(Math.random() * 3)
      for (let j = 0; j < cnt; j++) {
        const freq = chimeNotes[base + j]
        // FM bell through small reverb — sparkles ring out into the room
        fmBell(actx, freq, now + j * 0.16, 1.10, vol * (0.32 + j * 0.04), reverbSmall)
      }
      scheduleChime()
    }, delay)
    timers.push(t)
  }
  scheduleChime()

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
      // Bird through small reverb — distant, sits in the room
      o.connect(g); g.connect(reverbSmall)
      o.start(now); o.stop(now + 0.22)
      scheduleBird()
    }, delay)
    timers.push(t)
  }
  scheduleBird()

  return () => {
    stopped = true
    _master   = null
    _masterAC = null
    document.removeEventListener('visibilitychange', onVisibility)
    timers.forEach(clearTimeout)
    actx.close().catch(() => {})
  }
}
