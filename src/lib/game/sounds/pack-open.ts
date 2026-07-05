/**
 * Pack / chest opening sounds — synthesized via Web Audio API.
 * Complexity and volume scale with rarity, mirroring the pattern in hatch.ts.
 *
 *   playPackTear    – paper rip + wax-seal crack, on the tap that opens a pack
 *   playPackBurst   – boom + sparkle cascade, synced with the burst flash;
 *                     scales with the PACK's own rarity
 *   playChestUnlock – key jingle + hinge creak + lid clunk; scales with the
 *                     CHEST's own rarity
 *   playDropReveal  – short per-drop reveal tick; scales with the rarity of
 *                     the individual drop (or a plain tick if it has none).
 *                     Reserves only ~0.13s of queue time so rapid staggered
 *                     reveals (140ms apart) don't drift out of sync.
 */

import { getSharedAC, getSoundStartTime } from './shared-ac'

type RarityKey = string | null | undefined

// ── Shared helpers ────────────────────────────────────────────────────────────
function noiseBurst(
  ac: AudioContext, now: number, durationS: number,
  filterType: BiquadFilterType, freqStart: number, freqEnd: number, Q: number,
  vol: number, rampS: number,
): void {
  const len = Math.floor(ac.sampleRate * durationS)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  const filt = ac.createBiquadFilter()
  filt.type = filterType
  filt.frequency.setValueAtTime(freqStart, now)
  if (freqEnd !== freqStart) filt.frequency.exponentialRampToValueAtTime(freqEnd, now + durationS)
  filt.Q.value = Q
  const g = ac.createGain()
  g.gain.setValueAtTime(vol, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + rampS)
  src.connect(filt); filt.connect(g); g.connect(ac.destination)
  src.start(now); src.stop(now + rampS + 0.02)
}

function tick(ac: AudioContext, t: number, freq: number, vol: number, dur = 0.14): void {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + dur + 0.02)
}

function bassThump(ac: AudioContext, t: number, freqStart: number, freqEnd: number, vol: number, dur: number): void {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freqStart, t)
  o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.04)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + dur + 0.06)
}

// ── Pack tear ─────────────────────────────────────────────────────────────────
const TEAR_MULT: Record<string, number> = {
  comune: 0.55, non_comune: 0.62, raro: 0.70,
  epico: 0.80, leggendario: 0.92, mitologico: 1.00,
}

export function playPackTear(rarity?: RarityKey, vol = 0.55): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.30)
  const mult = TEAR_MULT[rarity ?? ''] ?? 0.62

  // Paper rip — bandpass noise sweeping down in pitch
  noiseBurst(ac, now, 0.22, 'bandpass', 2200, 900, 0.8, vol * mult * 0.6, 0.22)

  // Wax-seal crack — bright highpass transient right at the tear point
  noiseBurst(ac, now + 0.02, 0.05, 'highpass', 1800, 1800, 1, vol * mult, 0.05)
}

// ── Pack burst ────────────────────────────────────────────────────────────────
const BURST_NOTES: Record<string, number[]> = {
  comune:      [1046.5, 1318.5],
  non_comune:  [1046.5, 1318.5, 1567.98],
  raro:        [1046.5, 1318.5, 1567.98, 2093.0],
  epico:       [783.99, 1046.5, 1318.5, 1567.98, 2093.0],
  leggendario: [523.25, 783.99, 1046.5, 1318.5, 1567.98, 2093.0],
  mitologico:  [392.0, 523.25, 783.99, 1046.5, 1318.5, 1567.98, 2093.0, 2637.02],
}
const BURST_BASS_FREQ: Record<string, number> = {
  leggendario: 74, mitologico: 68,
}

export function playPackBurst(rarity?: RarityKey, vol = 0.55): void {
  const ac = getSharedAC(); if (!ac) return
  const notes = BURST_NOTES[rarity ?? ''] ?? BURST_NOTES.non_comune
  const now = getSoundStartTime(0.5 + notes.length * 0.045)

  bassThump(ac, now, BURST_BASS_FREQ[rarity ?? ''] ?? 90, 45, vol * 0.60, 0.30)
  noiseBurst(ac, now, 0.18, 'lowpass', 3200, 3200, 1, vol * 0.35, 0.18)

  notes.forEach((freq, i) => tick(ac, now + 0.08 + i * 0.045, freq, vol * 0.30, 0.42))
}

// ── Chest unlock ──────────────────────────────────────────────────────────────
const UNLOCK_MULT: Record<string, number> = {
  comune: 0.55, non_comune: 0.62, raro: 0.70,
  epico: 0.80, leggendario: 0.92, mitologico: 1.00,
}
const UNLOCK_BASS_FREQ: Record<string, number> = {
  leggendario: 64, mitologico: 58,
}

export function playChestUnlock(rarity?: RarityKey, vol = 0.55): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.9)
  const mult = UNLOCK_MULT[rarity ?? ''] ?? 0.62

  // Key jingle — two quick metallic ticks
  ;[1600, 2100].forEach((freq, i) => {
    const t = now + i * 0.05
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'triangle'
    o.frequency.value = freq
    g.gain.setValueAtTime(vol * mult * 0.35, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.09)
  })

  // Hinge creak — descending bandpass noise
  noiseBurst(ac, now + 0.12, 0.34, 'bandpass', 900, 320, 4, vol * mult * 0.30, 0.34)

  // Lid clunk — bass thump, deeper for rarer chests
  bassThump(ac, now + 0.5, UNLOCK_BASS_FREQ[rarity ?? ''] ?? 80, 48, vol * mult * 0.65, 0.26)
}

// ── Per-drop reveal ───────────────────────────────────────────────────────────
export function playDropReveal(rarity?: RarityKey, vol = 0.45): void {
  const ac = getSharedAC(); if (!ac) return
  // Short reservation keeps staggered reveals (140ms apart) from drifting late.
  const now = getSoundStartTime(0.13)

  if (!rarity) {
    tick(ac, now, 720, vol * 0.30, 0.10)
    return
  }

  if (rarity === 'comune') {
    tick(ac, now, 660, vol * 0.32, 0.16)
    tick(ac, now + 0.05, 880, vol * 0.22, 0.14)

  } else if (rarity === 'non_comune') {
    tick(ac, now, 660, vol * 0.34, 0.16)
    tick(ac, now + 0.06, 988, vol * 0.28, 0.20)

  } else if (rarity === 'raro') {
    ;[880, 1174.66, 1567.98].forEach((freq, i) => tick(ac, now + i * 0.045, freq, vol * 0.30, 0.22))

  } else if (rarity === 'epico') {
    ;[659.25, 987.77, 1318.5].forEach((freq, i) => tick(ac, now + i * 0.04, freq, vol * 0.34, 0.26))
    tick(ac, now, 110, vol * 0.30, 0.16)

  } else {
    // leggendario / mitologico — sub thump + widest sparkle
    bassThump(ac, now, rarity === 'mitologico' ? 66 : 74, 40, vol * 0.42, 0.22)
    const notes = rarity === 'mitologico'
      ? [659.25, 987.77, 1318.5, 1760, 2349.32]
      : [659.25, 987.77, 1318.5, 1760]
    notes.forEach((freq, i) => tick(ac, now + 0.03 + i * 0.035, freq, vol * 0.32, 0.30))
  }
}
