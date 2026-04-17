/**
 * Default attack sounds — synthesized via Web Audio API.
 * Played as fallback when a creature has no uploaded attack_sound_url.
 *
 * Each element has a distinct sonic character.
 * Rarity controls volume and duration — higher rarity = heavier, longer sound.
 *
 * Elements:
 *   fiamma    — sharp crackle + sizzle (fire)
 *   adriatico — bandpass whoosh + bubble pop (water)
 *   bosco     — rustling noise + soft thud (nature/forest)
 *   terra     — deep bass hit + low rumble (earth/rock)
 *   armonia   — clean punch tone + noise layer (normal)
 */

import type { Element, Rarity } from '@/lib/types'

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    return new ((window as any).AudioContext || (window as any).webkitAudioContext)()
  } catch { return null }
}

// Volume and duration scale with rarity
const RARITY_VOL: Record<string, number> = {
  comune:      0.38,
  non_comune:  0.48,
  raro:        0.58,
  epico:       0.70,
  leggendario: 0.84,
  mitologico:  1.00,
}

const RARITY_DUR: Record<string, number> = {
  comune:      0.18,
  non_comune:  0.24,
  raro:        0.32,
  epico:       0.42,
  leggendario: 0.55,
  mitologico:  0.70,
}

// ── fiamma (fire) ─────────────────────────────────────────────────────────────
// Sharp high-pass crackle + descending sizzle oscillator
function playFiamma(ac: AudioContext, vol: number, dur: number) {
  const now = ac.currentTime

  const len = Math.floor(ac.sampleRate * (dur + 0.10))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5)
  const src = ac.createBufferSource()
  src.buffer = buf
  const hpf = ac.createBiquadFilter()
  hpf.type = 'highpass'
  hpf.frequency.value = 1200
  const nGain = ac.createGain()
  nGain.gain.value = vol * 0.85
  src.connect(hpf); hpf.connect(nGain); nGain.connect(ac.destination)
  src.start(now)

  const osc = ac.createOscillator()
  const oGain = ac.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(220, now)
  osc.frequency.exponentialRampToValueAtTime(110, now + dur)
  oGain.gain.setValueAtTime(vol * 0.45, now)
  oGain.gain.exponentialRampToValueAtTime(0.001, now + dur)
  osc.connect(oGain); oGain.connect(ac.destination)
  osc.start(now); osc.stop(now + dur + 0.02)
}

// ── adriatico (water) ─────────────────────────────────────────────────────────
// Bandpass whoosh (500→200 Hz sweep) + bubble pop at mid-point
function playAdriatico(ac: AudioContext, vol: number, dur: number) {
  const now = ac.currentTime

  const len = Math.floor(ac.sampleRate * (dur + 0.15))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  const bpf = ac.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.setValueAtTime(500, now)
  bpf.frequency.exponentialRampToValueAtTime(200, now + dur * 0.6)
  bpf.Q.value = 1.2
  const nGain = ac.createGain()
  nGain.gain.setValueAtTime(0, now)
  nGain.gain.linearRampToValueAtTime(vol * 0.65, now + 0.03)
  nGain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.10)
  src.connect(bpf); bpf.connect(nGain); nGain.connect(ac.destination)
  src.start(now)

  // Bubble pop
  const t = now + dur * 0.40
  const pop = ac.createOscillator()
  const pGain = ac.createGain()
  pop.type = 'sine'
  pop.frequency.setValueAtTime(600, t)
  pop.frequency.exponentialRampToValueAtTime(200, t + 0.06)
  pGain.gain.setValueAtTime(vol * 0.50, t)
  pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
  pop.connect(pGain); pGain.connect(ac.destination)
  pop.start(t); pop.stop(t + 0.10)
}

// ── bosco (forest/nature) ─────────────────────────────────────────────────────
// Mid-band rustling noise + soft low thud
function playBosco(ac: AudioContext, vol: number, dur: number) {
  const now = ac.currentTime

  const len = Math.floor(ac.sampleRate * (dur + 0.12))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.2)
  const src = ac.createBufferSource()
  src.buffer = buf
  const bpf = ac.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.setValueAtTime(700, now)
  bpf.frequency.exponentialRampToValueAtTime(350, now + dur)
  bpf.Q.value = 1.8
  const nGain = ac.createGain()
  nGain.gain.value = vol * 0.60
  src.connect(bpf); bpf.connect(nGain); nGain.connect(ac.destination)
  src.start(now)

  const thud = ac.createOscillator()
  const tGain = ac.createGain()
  thud.type = 'sine'
  thud.frequency.setValueAtTime(130, now)
  thud.frequency.exponentialRampToValueAtTime(55, now + 0.14)
  tGain.gain.setValueAtTime(vol * 0.60, now)
  tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
  thud.connect(tGain); tGain.connect(ac.destination)
  thud.start(now); thud.stop(now + 0.18)
}

// ── terra (earth/rock) ────────────────────────────────────────────────────────
// Deep sine bass drop + low-pass filtered rumble noise
function playTerra(ac: AudioContext, vol: number, dur: number) {
  const now = ac.currentTime

  const bass = ac.createOscillator()
  const bGain = ac.createGain()
  bass.type = 'sine'
  bass.frequency.setValueAtTime(80, now)
  bass.frequency.exponentialRampToValueAtTime(30, now + dur)
  bGain.gain.setValueAtTime(vol * 0.90, now)
  bGain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.05)
  bass.connect(bGain); bGain.connect(ac.destination)
  bass.start(now); bass.stop(now + dur + 0.07)

  const len = Math.floor(ac.sampleRate * (dur + 0.10))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
  const src = ac.createBufferSource()
  src.buffer = buf
  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = 300
  const nGain = ac.createGain()
  nGain.gain.value = vol * 0.55
  src.connect(lpf); lpf.connect(nGain); nGain.connect(ac.destination)
  src.start(now)
}

// ── armonia (normal/harmony) ──────────────────────────────────────────────────
// Clean sine punch + mid-band noise layer
function playArmonia(ac: AudioContext, vol: number, dur: number) {
  const now = ac.currentTime

  const osc = ac.createOscillator()
  const oGain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(320, now)
  osc.frequency.exponentialRampToValueAtTime(160, now + dur)
  oGain.gain.setValueAtTime(vol * 0.75, now)
  oGain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.04)
  osc.connect(oGain); oGain.connect(ac.destination)
  osc.start(now); osc.stop(now + dur + 0.06)

  const len = Math.floor(ac.sampleRate * (dur + 0.08))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5)
  const src = ac.createBufferSource()
  src.buffer = buf
  const bpf = ac.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.value = 900
  bpf.Q.value = 2
  const nGain = ac.createGain()
  nGain.gain.value = vol * 0.45
  src.connect(bpf); bpf.connect(nGain); nGain.connect(ac.destination)
  src.start(now)
}

// ── Main export ───────────────────────────────────────────────────────────────
export function playDefaultAttack(element: Element | string, rarity: Rarity | string) {
  const ac = ctx()
  if (!ac) return

  const vol = RARITY_VOL[rarity] ?? 0.50
  const dur = RARITY_DUR[rarity] ?? 0.25

  switch (element as Element) {
    case 'fiamma':    playFiamma(ac, vol, dur);    break
    case 'adriatico': playAdriatico(ac, vol, dur); break
    case 'bosco':     playBosco(ac, vol, dur);     break
    case 'terra':     playTerra(ac, vol, dur);     break
    case 'armonia':
    default:          playArmonia(ac, vol, dur);   break
  }

  const closingDelay = ((RARITY_DUR[rarity] ?? 0.25) + 0.35) * 1000
  setTimeout(() => ac.close(), closingDelay)
}
