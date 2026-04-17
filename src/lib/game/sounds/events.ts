/**
 * Game event sounds — synthesized via Web Audio API.
 *
 *   playKnockout       – creature faints (heavy thud + descending tone)
 *   playFlee           – player or wild creature escapes (upward whoosh)
 *   playLevelUp        – player gains a level (ascending C-major arpeggio)
 *   playMissionComplete– mission finished (short G-major fanfare)
 *   playVictory        – battle won (triumphant 5-note fanfare + chord)
 *   playDefeat         – battle lost (descending minor + rumble)
 */

function makeAC(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    return new ((window as any).AudioContext || (window as any).webkitAudioContext)()
  } catch {
    return null
  }
}

// ── Knockout ──────────────────────────────────────────────────────────────────
export function playKnockout(vol = 0.55): void {
  const ac = makeAC(); if (!ac) return
  const now = ac.currentTime

  // Bass punch — sine that drops from 75 Hz to 32 Hz
  const bass  = ac.createOscillator()
  const bassG = ac.createGain()
  bass.type = 'sine'
  bass.frequency.setValueAtTime(75, now)
  bass.frequency.exponentialRampToValueAtTime(32, now + 0.38)
  bassG.gain.setValueAtTime(vol * 0.75, now)
  bassG.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
  bass.connect(bassG); bassG.connect(ac.destination)
  bass.start(now); bass.stop(now + 0.44)

  // Low noise thud — filtered white noise burst
  const noiseLen = Math.floor(ac.sampleRate * 0.07)
  const noiseBuf = ac.createBuffer(1, noiseLen, ac.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1
  const nSrc = ac.createBufferSource()
  nSrc.buffer = noiseBuf
  const nLpf = ac.createBiquadFilter()
  nLpf.type = 'lowpass'; nLpf.frequency.value = 260
  const nG = ac.createGain()
  nG.gain.setValueAtTime(vol * 0.65, now)
  nG.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
  nSrc.connect(nLpf); nLpf.connect(nG); nG.connect(ac.destination)
  nSrc.start(now); nSrc.stop(now + 0.08)

  // Descending whimper tone — signals defeat
  const w  = ac.createOscillator()
  const wG = ac.createGain()
  w.type = 'sine'
  w.frequency.setValueAtTime(310, now + 0.05)
  w.frequency.exponentialRampToValueAtTime(88, now + 0.58)
  wG.gain.setValueAtTime(0, now)
  wG.gain.linearRampToValueAtTime(vol * 0.42, now + 0.08)
  wG.gain.exponentialRampToValueAtTime(0.001, now + 0.62)
  w.connect(wG); wG.connect(ac.destination)
  w.start(now); w.stop(now + 0.65)

  setTimeout(() => ac.close().catch(() => {}), 800)
}

// ── Flee ──────────────────────────────────────────────────────────────────────
export function playFlee(vol = 0.40): void {
  const ac = makeAC(); if (!ac) return
  const now = ac.currentTime

  // Rising whoosh — bandpass noise sweeping 300 → 3500 Hz
  const noiseLen = Math.floor(ac.sampleRate * 0.3)
  const noiseBuf = ac.createBuffer(1, noiseLen, ac.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1
  const nSrc = ac.createBufferSource()
  nSrc.buffer = noiseBuf
  const bpf = ac.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.setValueAtTime(300, now)
  bpf.frequency.exponentialRampToValueAtTime(3500, now + 0.28)
  bpf.Q.value = 1.5
  const nG = ac.createGain()
  nG.gain.setValueAtTime(vol * 0.55, now)
  nG.gain.exponentialRampToValueAtTime(0.001, now + 0.30)
  nSrc.connect(bpf); bpf.connect(nG); nG.connect(ac.destination)
  nSrc.start(now); nSrc.stop(now + 0.31)

  // Quick scurrying blips (footstep feel)
  ;[0, 0.06, 0.13].forEach(d => {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = 180 + Math.random() * 90
    g.gain.setValueAtTime(0, now + d)
    g.gain.linearRampToValueAtTime(vol * 0.22, now + d + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.07)
    o.connect(g); g.connect(ac.destination)
    o.start(now + d); o.stop(now + d + 0.08)
  })

  setTimeout(() => ac.close().catch(() => {}), 450)
}

// ── Level Up ──────────────────────────────────────────────────────────────────
export function playLevelUp(vol = 0.55): void {
  const ac = makeAC(); if (!ac) return
  const now = ac.currentTime

  // C-major ascending arpeggio: C4 → E4 → G4 → C5 → E5
  const arpNotes = [261.63, 329.63, 392.0, 523.25, 659.25]
  arpNotes.forEach((freq, i) => {
    const t = now + i * 0.12
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.52, t + 0.016)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.50)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.53)
  })

  // Final sparkle chord: E5 + G5 + C6
  const cs = now + arpNotes.length * 0.12 - 0.04  // slight overlap with last arpeggio note
  ;[659.25, 783.99, 1046.5].forEach(freq => {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, cs)
    g.gain.linearRampToValueAtTime(vol * 0.32, cs + 0.02)
    g.gain.setValueAtTime(vol * 0.32, cs + 0.42)
    g.gain.exponentialRampToValueAtTime(0.001, cs + 1.25)
    o.connect(g); g.connect(ac.destination)
    o.start(cs); o.stop(cs + 1.30)
  })

  // High shimmer sparkle: C7 → E7 → G7
  ;[2093.0, 2637.02, 3135.96].forEach((freq, i) => {
    const t = cs + i * 0.07
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.18, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.40)
  })

  setTimeout(() => ac.close().catch(() => {}), 2100)
}

// ── Mission Complete ───────────────────────────────────────────────────────────
export function playMissionComplete(vol = 0.50): void {
  const ac = makeAC(); if (!ac) return
  const now = ac.currentTime

  // G-major ascending motif: G4 → B4 → D5 → G5
  const notes = [392.0, 493.88, 587.33, 783.99]
  notes.forEach((freq, i) => {
    const t = now + i * 0.10
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.50, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.50)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.52)
  })

  // Shimmer finish: G6 + D7
  const shimStart = now + notes.length * 0.10
  ;[1567.98, 2349.32].forEach((freq, i) => {
    const t = shimStart + i * 0.05
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.22, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.58)
  })

  setTimeout(() => ac.close().catch(() => {}), 1400)
}

// ── Victory ───────────────────────────────────────────────────────────────────
export function playVictory(vol = 0.60): void {
  const ac = makeAC(); if (!ac) return
  const now = ac.currentTime

  // Triumphant 5-note rising fanfare: C4 → E4 → G4 → C5 → E5
  const fanfare = [261.63, 329.63, 392.0, 523.25, 659.25]
  fanfare.forEach((freq, i) => {
    const t   = now + i * 0.14
    const dur = i === fanfare.length - 1 ? 1.05 : 0.55  // last note held longer
    const o   = ac.createOscillator()
    const g   = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.55, t + 0.018)
    g.gain.setValueAtTime(vol * 0.55, t + dur - 0.12)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.12)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + dur + 0.16)
  })

  // Held C-major chord: C5 + E5 + G5
  const cs = now + fanfare.length * 0.14 + 0.06
  ;[523.25, 659.25, 783.99].forEach(freq => {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, cs)
    g.gain.linearRampToValueAtTime(vol * 0.35, cs + 0.022)
    g.gain.setValueAtTime(vol * 0.35, cs + 0.82)
    g.gain.exponentialRampToValueAtTime(0.001, cs + 1.65)
    o.connect(g); g.connect(ac.destination)
    o.start(cs); o.stop(cs + 1.70)
  })

  // Bell cascade overtones
  ;[1046.5, 1318.5, 1567.98, 2093.0].forEach((freq, i) => {
    const t = cs + i * 0.055
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.20, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.85)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.88)
  })

  setTimeout(() => ac.close().catch(() => {}), 2900)
}

// ── Defeat ────────────────────────────────────────────────────────────────────
export function playDefeat(vol = 0.45): void {
  const ac = makeAC(); if (!ac) return
  const now = ac.currentTime

  // Descending A-natural minor: A4 → F4 → D4 → Bb3
  const notes = [440.0, 349.23, 293.66, 233.08]
  notes.forEach((freq, i) => {
    const t = now + i * 0.24
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.48, t + 0.022)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.58)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.60)
  })

  // Low sine rumble throughout
  const r  = ac.createOscillator()
  const rG = ac.createGain()
  r.type = 'sine'; r.frequency.value = 52
  rG.gain.setValueAtTime(0, now)
  rG.gain.linearRampToValueAtTime(vol * 0.30, now + 0.20)
  rG.gain.setValueAtTime(vol * 0.30, now + 0.85)
  rG.gain.exponentialRampToValueAtTime(0.001, now + 1.48)
  r.connect(rG); rG.connect(ac.destination)
  r.start(now); r.stop(now + 1.52)

  setTimeout(() => ac.close().catch(() => {}), 1900)
}
