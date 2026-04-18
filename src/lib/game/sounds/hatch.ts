/**
 * Egg hatch sounds — synthesized via Web Audio API.
 * Sound complexity and volume scale with the creature's rarity.
 *
 *   comune      – crack pop + brief chirp
 *   non_comune  – crack + 2-note melody (C4 → E4)
 *   raro        – crack + C-pentatonic sparkle arpeggio
 *   epico       – crack + full C-major arpeggio + held chord
 *   leggendario – epic bass hit + 5-note fanfare + sparkle cascade
 *   mitologico  – ultimate: bass boom + 9-note sweep + cosmic sparkle cascade
 */

import { getSharedAC, getSoundStartTime } from './shared-ac'

// Approximate total duration per rarity — used to reserve a queue slot
const HATCH_DURATION: Record<string, number> = {
  comune:      0.30,
  non_comune:  0.85,
  raro:        1.05,
  epico:       1.90,
  leggendario: 1.70,
  mitologico:  2.25,
}

// Crack transient shared by all rarities — highpass-filtered noise burst
function playCrack(ac: AudioContext, now: number, vol: number): void {
  const len = Math.floor(ac.sampleRate * 0.05)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d   = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  const hpf = ac.createBiquadFilter()
  hpf.type = 'highpass'; hpf.frequency.value = 1400
  const g = ac.createGain()
  g.gain.setValueAtTime(vol, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  src.connect(hpf); hpf.connect(g); g.connect(ac.destination)
  src.start(now); src.stop(now + 0.06)
}

// Simple sine bell tone helper
function bell(ac: AudioContext, freq: number, t: number, vol: number, dur = 0.55): void {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + dur + 0.02)
}

export function playEggHatch(rarity: string, vol = 0.50): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(HATCH_DURATION[rarity] ?? 1.05)

  // Crack volume scales with rarity
  const crackVols: Record<string, number> = {
    comune: 0.45, non_comune: 0.55, raro: 0.65,
    epico: 0.75, leggendario: 0.88, mitologico: 1.00,
  }
  playCrack(ac, now, vol * (crackVols[rarity] ?? 0.55))

  if (rarity === 'comune') {
    // Just a quick chirp
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(760, now + 0.06)
    o.frequency.exponentialRampToValueAtTime(1180, now + 0.18)
    g.gain.setValueAtTime(0, now + 0.06)
    g.gain.linearRampToValueAtTime(vol * 0.35, now + 0.07)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    o.connect(g); g.connect(ac.destination)
    o.start(now + 0.06); o.stop(now + 0.24)

  } else if (rarity === 'non_comune') {
    // C4 → E4 two-note melody
    bell(ac, 261.63, now + 0.06, vol * 0.42)
    bell(ac, 329.63, now + 0.22, vol * 0.42)

  } else if (rarity === 'raro') {
    // C pentatonic ascending sparkle: C5 E5 G5 C6
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      bell(ac, freq, now + 0.06 + i * 0.11, vol * 0.40, 0.60)
    })

  } else if (rarity === 'epico') {
    // Full C-major arpeggio: C4 E4 G4 C5 E5
    ;[261.63, 329.63, 392.0, 523.25, 659.25].forEach((freq, i) => {
      bell(ac, freq, now + 0.06 + i * 0.10, vol * 0.45, 0.60)
    })
    // Held chord C5+E5+G5 after arpeggio
    const cs = now + 0.06 + 5 * 0.10
    ;[523.25, 659.25, 783.99].forEach(freq => {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = 'sine'; o.frequency.value = freq
      g.gain.setValueAtTime(0, cs)
      g.gain.linearRampToValueAtTime(vol * 0.28, cs + 0.022)
      g.gain.setValueAtTime(vol * 0.28, cs + 0.52)
      g.gain.exponentialRampToValueAtTime(0.001, cs + 1.25)
      o.connect(g); g.connect(ac.destination)
      o.start(cs); o.stop(cs + 1.28)
    })

  } else if (rarity === 'leggendario') {
    // Epic bass hit
    const bass  = ac.createOscillator()
    const bassG = ac.createGain()
    bass.type = 'sine'
    bass.frequency.setValueAtTime(78, now + 0.03)
    bass.frequency.exponentialRampToValueAtTime(42, now + 0.38)
    bassG.gain.setValueAtTime(vol * 0.62, now + 0.03)
    bassG.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
    bass.connect(bassG); bassG.connect(ac.destination)
    bass.start(now + 0.03); bass.stop(now + 0.44)

    // 5-note fanfare: C4 E4 G4 C5 G5
    ;[261.63, 329.63, 392.0, 523.25, 783.99].forEach((freq, i) => {
      bell(ac, freq, now + 0.10 + i * 0.12, vol * 0.50, 0.65)
    })

    // Sparkle cascade: C6 E6 G6 C7 E7
    ;[1046.5, 1318.5, 1567.98, 2093.0, 2637.02].forEach((freq, i) => {
      bell(ac, freq, now + 0.72 + i * 0.08, vol * 0.28, 0.55)
    })

  } else {
    // mitologico — ultimate fanfare
    // Deep bass boom
    const bass  = ac.createOscillator()
    const bassG = ac.createGain()
    bass.type = 'sine'
    bass.frequency.setValueAtTime(58, now)
    bass.frequency.exponentialRampToValueAtTime(28, now + 0.52)
    bassG.gain.setValueAtTime(vol * 0.72, now + 0.02)
    bassG.gain.exponentialRampToValueAtTime(0.001, now + 0.56)
    bass.connect(bassG); bassG.connect(ac.destination)
    bass.start(now); bass.stop(now + 0.58)

    // 9-note epic sweep across two octaves
    ;[130.81, 164.81, 196.0, 261.63, 329.63, 392.0, 523.25, 659.25, 783.99].forEach((freq, i) => {
      bell(ac, freq, now + 0.08 + i * 0.09, vol * 0.45, 0.65)
    })

    // Cosmic sparkle cascade — alternating octaves for shimmer
    ;[1046.5, 2093.0, 1318.5, 2637.02, 1567.98, 3135.96, 2093.0, 4186.01].forEach((freq, i) => {
      bell(ac, freq, now + 0.95 + i * 0.08, vol * 0.24, 0.62)
    })
  }

}
