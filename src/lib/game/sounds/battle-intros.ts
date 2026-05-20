/**
 * Battle intro stingers — synthesized via Web Audio API.
 *
 *   playEncounterSound  – wild creature appears (UNCHANGED, already cinematic)
 *   playBattleSound     – PvP duel starts (rewritten: 3-phase with reverb tail)
 *   playBossSound       – Boss / Capo Palestra fight starts (rewritten:
 *                          3-phase epic with timpani fill and cathedral tail)
 *
 * Duel and boss now route through the master bus + cathedral reverb send so
 * the impact has natural spatial decay instead of dry oscillator tails.
 */

import { getSharedAC, getSoundStartTime } from './shared-ac'
import { getMasterBus } from './master-bus'
import { getReverbSend } from './procedural-reverb'
import { kick, snare, tom } from './drums'

// ── Wild creature encounter (UNCHANGED) ───────────────────────────────────────
// "Something stirs in the ancient forest…"
// Layers: nature rustle → deep earth pulse → chromatic tension crawl →
//         E-minor pentatonic ascending motif (warm bell timbre) →
//         high magic shimmer → sustained E-minor presence chord
export function playEncounterSound(vol = 0.55) {
  const ac = getSharedAC()
  if (!ac) return
  const now = getSoundStartTime(1.8)

  // 1. Nature rustle — bandpass noise sweeping mid-high (movement in undergrowth)
  const rustleLen = Math.floor(ac.sampleRate * 0.38)
  const rustleBuf = ac.createBuffer(1, rustleLen, ac.sampleRate)
  const rd = rustleBuf.getChannelData(0)
  for (let i = 0; i < rustleLen; i++) {
    const env = i < rustleLen * 0.12
      ? i / (rustleLen * 0.12)
      : Math.pow(1 - (i - rustleLen * 0.12) / (rustleLen * 0.88), 1.6)
    rd[i] = (Math.random() * 2 - 1) * env
  }
  const rSrc = ac.createBufferSource()
  rSrc.buffer = rustleBuf
  const rBpf = ac.createBiquadFilter()
  rBpf.type = 'bandpass'
  rBpf.frequency.setValueAtTime(500, now)
  rBpf.frequency.exponentialRampToValueAtTime(3000, now + 0.16)
  rBpf.frequency.exponentialRampToValueAtTime(700, now + 0.38)
  rBpf.Q.value = 2.2
  const rG = ac.createGain()
  rG.gain.value = vol * 0.13
  rSrc.connect(rBpf); rBpf.connect(rG); rG.connect(ac.destination)
  rSrc.start(now)

  // 2. Deep earth pulse — heavy sine decay (weight, presence, danger nearby)
  const pulse = ac.createOscillator()
  const pulseG = ac.createGain()
  pulse.type = 'sine'
  pulse.frequency.setValueAtTime(78, now + 0.01)
  pulse.frequency.exponentialRampToValueAtTime(40, now + 0.65)
  pulseG.gain.setValueAtTime(0, now)
  pulseG.gain.linearRampToValueAtTime(vol * 0.50, now + 0.025)
  pulseG.gain.exponentialRampToValueAtTime(0.001, now + 0.78)
  pulse.connect(pulseG); pulseG.connect(ac.destination)
  pulse.start(now); pulse.stop(now + 0.80)

  // 3. Chromatic tension crawl — E2→F2→F#2→G2, triangle, very soft (unease)
  ;[82.41, 87.31, 92.50, 98.00].forEach((freq, i) => {
    const t = now + i * 0.055
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'triangle'; o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.10, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.30)
  })

  // 4. E-minor pentatonic ascending motif: E3 G3 A3 B3 E4 G4
  ;[164.81, 196.00, 220.00, 246.94, 329.63, 392.00].forEach((freq, i) => {
    const t = now + 0.20 + i * 0.12
    // Fundamental
    const o1 = ac.createOscillator()
    const g1 = ac.createGain()
    o1.type = 'sine'; o1.frequency.value = freq
    g1.gain.setValueAtTime(0, t)
    g1.gain.linearRampToValueAtTime(vol * 0.38, t + 0.032)
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.52)
    o1.connect(g1); g1.connect(ac.destination)
    o1.start(t); o1.stop(t + 0.55)
    // 2nd harmonic — warmth
    const o2 = ac.createOscillator()
    const g2 = ac.createGain()
    o2.type = 'sine'; o2.frequency.value = freq * 2
    g2.gain.setValueAtTime(0, t)
    g2.gain.linearRampToValueAtTime(vol * 0.09, t + 0.025)
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
    o2.connect(g2); g2.connect(ac.destination)
    o2.start(t); o2.stop(t + 0.35)
    // Detuned 3rd — shimmer texture
    const o3 = ac.createOscillator()
    const g3 = ac.createGain()
    o3.type = 'sine'; o3.frequency.value = freq * 3.02
    g3.gain.setValueAtTime(0, t)
    g3.gain.linearRampToValueAtTime(vol * 0.035, t + 0.018)
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.20)
    o3.connect(g3); g3.connect(ac.destination)
    o3.start(t); o3.stop(t + 0.22)
  })

  // 5. High magic shimmer — E5 B5 E6 (ancient forest magic, very delicate)
  const shimStart = now + 0.20 + 6 * 0.12 + 0.05
  ;[659.25, 987.77, 1318.51].forEach((freq, i) => {
    const t = shimStart + i * 0.10
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'; o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.16, t + 0.014)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.62)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.65)
  })

  // 6. Sustained E-minor chord — E3+G3+B3, swells in mid-motif, fades slowly
  const chordT = now + 0.20 + 2 * 0.12
  ;[164.81, 196.00, 246.94].forEach(freq => {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'; o.frequency.value = freq
    g.gain.setValueAtTime(0, chordT)
    g.gain.linearRampToValueAtTime(vol * 0.09, chordT + 0.10)
    g.gain.setValueAtTime(vol * 0.09, chordT + 0.58)
    g.gain.exponentialRampToValueAtTime(0.001, chordT + 1.25)
    o.connect(g); g.connect(ac.destination)
    o.start(chordT); o.stop(chordT + 1.28)
  })
}

// ── PvP Duel intro — 3-phase: ANTICIPATION → IMPACT → CODA (~1.0 s) ──────────
//
// Phase 1 (0 - 0.30 s): reverse riser noise (200 → 4 kHz bandpass) + sub-pulse
//                       falling 80 → 40 Hz — anticipation building under
// Phase 2 (0.30 s):     kick + snare hit + power chord saw stab into reverb
// Phase 3 (0.30-1.0):   high descending ping (1320 → 660 Hz) + reverb tail
export function playBattleSound(vol = 0.55) {
  const ac = getSharedAC()
  if (!ac) return
  const now = getSoundStartTime(1.0)

  const master  = getMasterBus(ac)
  const reverb  = getReverbSend(ac, 'cathedral')

  // ── Phase 1: anticipation (0 - 0.30 s) ──────────────────────────────────────

  // Reverse riser noise — bandpass sweeping 200 → 4 kHz, swelling in volume
  const riseLen = Math.floor(ac.sampleRate * 0.30)
  const riseBuf = ac.createBuffer(1, riseLen, ac.sampleRate)
  const rd = riseBuf.getChannelData(0)
  for (let i = 0; i < riseLen; i++) rd[i] = (Math.random() * 2 - 1) * (i / riseLen)
  const rSrc = ac.createBufferSource()
  rSrc.buffer = riseBuf
  const rBpf = ac.createBiquadFilter()
  rBpf.type = 'bandpass'
  rBpf.frequency.setValueAtTime(200, now)
  rBpf.frequency.exponentialRampToValueAtTime(4000, now + 0.30)
  rBpf.Q.value = 1.2
  const rG = ac.createGain()
  rG.gain.setValueAtTime(0, now)
  rG.gain.linearRampToValueAtTime(vol * 0.45, now + 0.28)
  rG.gain.exponentialRampToValueAtTime(0.001, now + 0.34)
  rSrc.connect(rBpf); rBpf.connect(rG); rG.connect(master)
  rSrc.start(now)

  // Sub-pulse falling 80 → 40 Hz — anchors the riser at the low end
  const sub = ac.createOscillator()
  const sG  = ac.createGain()
  sub.type  = 'sine'
  sub.frequency.setValueAtTime(80, now)
  sub.frequency.exponentialRampToValueAtTime(40, now + 0.30)
  sG.gain.setValueAtTime(0, now)
  sG.gain.linearRampToValueAtTime(vol * 0.45, now + 0.18)
  sG.gain.exponentialRampToValueAtTime(0.001, now + 0.32)
  sub.connect(sG); sG.connect(master)
  sub.start(now); sub.stop(now + 0.34)

  // ── Phase 2: impact (0.30 s) ────────────────────────────────────────────────

  const impactT = now + 0.30

  // Kick + snare doubled hit — uses the new multi-layer drum module
  kick(ac, impactT, vol * 1.4, master)
  snare(ac, impactT, vol * 1.0, master)

  // Power chord G2 D3 G3 B3 — saw cluster, routed through reverb for tail
  const chord = [98.00, 146.83, 196.00, 246.94]
  for (let i = 0; i < chord.length; i++) {
    const freq = chord[i]
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.type  = 'sawtooth'
    osc.frequency.value = freq
    osc.detune.value = (i % 2 === 0 ? -7 : 7)  // ± 7 cents for chorus
    g.gain.setValueAtTime(0, impactT)
    g.gain.linearRampToValueAtTime(vol * 0.22, impactT + 0.008)
    g.gain.exponentialRampToValueAtTime(0.001, impactT + 0.55)
    osc.connect(g); g.connect(reverb)
    osc.start(impactT); osc.stop(impactT + 0.6)
  }

  // ── Phase 3: coda (0.30 - 1.0 s) ────────────────────────────────────────────

  // High descending ping (1320 → 660 Hz) — the "metal" ring of clashing weapons
  const ping  = ac.createOscillator()
  const pGain = ac.createGain()
  ping.type   = 'sine'
  ping.frequency.setValueAtTime(1320, impactT + 0.02)
  ping.frequency.exponentialRampToValueAtTime(660, impactT + 0.55)
  pGain.gain.setValueAtTime(vol * 0.32, impactT + 0.02)
  pGain.gain.exponentialRampToValueAtTime(0.001, impactT + 0.62)
  ping.connect(pGain); pGain.connect(reverb)
  ping.start(impactT + 0.02); ping.stop(impactT + 0.65)
}

// ── Boss / Capo Palestra intro — 3-phase EPIC (~1.8 s) ──────────────────────
//
// Phase 1 (0 - 0.60 s): deep 30 Hz rumble + chromatic crawl E2→F2→F#2→G2
//                       — the boss WAKES UP
// Phase 2 (0.60 - 0.90): double kick+snare hit + C minor chord stab into
//                        cathedral reverb — the FIRST STEP
// Phase 3 (0.90 - 1.80): chord swell (Cm9) + descending sweep G6 → G4 +
//                        3-tom timpani fill at the end — the ROAR
export function playBossSound(vol = 0.55) {
  const ac = getSharedAC()
  if (!ac) return
  const now = getSoundStartTime(1.8)

  const master = getMasterBus(ac)
  const reverb = getReverbSend(ac, 'cathedral')

  // ── Phase 1: AWAKENING (0 - 0.60 s) ─────────────────────────────────────────

  // Deep 30 Hz rumble — sub presence, almost subconscious
  const rumble = ac.createOscillator()
  const rumbleG = ac.createGain()
  rumble.type = 'sine'
  rumble.frequency.value = 30
  rumbleG.gain.setValueAtTime(0, now)
  rumbleG.gain.linearRampToValueAtTime(vol * 0.55, now + 0.35)
  rumbleG.gain.setValueAtTime(vol * 0.55, now + 0.50)
  rumbleG.gain.exponentialRampToValueAtTime(0.001, now + 0.95)
  rumble.connect(rumbleG); rumbleG.connect(master)
  rumble.start(now); rumble.stop(now + 1.0)

  // Chromatic crawl — triangles, building unease
  ;[82.41, 87.31, 92.50, 98.00].forEach((freq, i) => {
    const t = now + 0.05 + i * 0.08
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'triangle'; o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.14, t + 0.020)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    o.connect(g); g.connect(master)
    o.start(t); o.stop(t + 0.38)
  })

  // ── Phase 2: FIRST STEP (0.60 - 0.90 s) ─────────────────────────────────────

  const hit1T = now + 0.60
  const hit2T = now + 0.78

  // Two devastating hits — full kit doubled
  kick(ac, hit1T, vol * 1.6, master)
  snare(ac, hit1T, vol * 1.1, master)
  kick(ac, hit2T, vol * 1.2, master)
  snare(ac, hit2T, vol * 0.85, master)

  // C minor chord stab (C3 Eb3 G3 C4) on the first hit — heavy, low
  ;[130.81, 155.56, 196.00, 261.63].forEach((freq, i) => {
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.type = i % 2 === 0 ? 'sawtooth' : 'square'
    osc.frequency.value = freq
    osc.detune.value = (i % 2 === 0 ? -5 : 5)
    g.gain.setValueAtTime(0, hit1T)
    g.gain.linearRampToValueAtTime(vol * 0.20, hit1T + 0.008)
    g.gain.exponentialRampToValueAtTime(0.001, hit1T + 0.85)
    osc.connect(g); g.connect(reverb)
    osc.start(hit1T); osc.stop(hit1T + 0.9)
  })

  // ── Phase 3: ROAR (0.90 - 1.80 s) ───────────────────────────────────────────

  const roarT = now + 0.92

  // Cm9 chord swell (C3 Eb3 G3 Bb3 D4) — into cathedral reverb for big space
  ;[130.81, 155.56, 196.00, 233.08, 293.66].forEach(freq => {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sawtooth'; o.frequency.value = freq
    o.detune.value = (Math.random() * 14 - 7)
    g.gain.setValueAtTime(0, roarT)
    g.gain.linearRampToValueAtTime(vol * 0.14, roarT + 0.10)
    g.gain.setValueAtTime(vol * 0.14, roarT + 0.55)
    g.gain.exponentialRampToValueAtTime(0.001, roarT + 0.88)
    o.connect(g); g.connect(reverb)
    o.start(roarT); o.stop(roarT + 0.92)
  })

  // Descending sweep G6 → G4 — the boss's "voice"
  const sweep  = ac.createOscillator()
  const swGain = ac.createGain()
  sweep.type   = 'sine'
  sweep.frequency.setValueAtTime(1568, roarT)
  sweep.frequency.exponentialRampToValueAtTime(392, roarT + 0.78)
  swGain.gain.setValueAtTime(0, roarT)
  swGain.gain.linearRampToValueAtTime(vol * 0.40, roarT + 0.10)
  swGain.gain.exponentialRampToValueAtTime(0.001, roarT + 0.82)
  sweep.connect(swGain); swGain.connect(reverb)
  sweep.start(roarT); sweep.stop(roarT + 0.85)

  // 3-tom timpani fill at the very end — closes the intro with weight
  const fillStart = now + 1.40
  tom(ac, fillStart,         280, vol * 1.1, master)
  tom(ac, fillStart + 0.13,  220, vol * 1.1, master)
  tom(ac, fillStart + 0.26,  160, vol * 1.4, master)
}
