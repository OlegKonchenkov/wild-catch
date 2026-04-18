/**
 * Catch-action sounds — synthesized via Web Audio API.
 * No external files, no copyright concerns, works offline.
 *
 * playCatchAttempt  — net leaves hand: rising whoosh + spin rattle + impact thud
 * playCatchFail     — net shakes and breaks open: clunks + descending wail
 * playCatchSuccess  — creature caught: ascending fanfare + sparkle chimes
 */

import { getSharedAC, getSoundStartTime } from './shared-ac'

// ── Catch attempt ─────────────────────────────────────────────────────────────
// Rising bandpass whoosh + spin rattle oscillator + bass thud on landing
export function playCatchAttempt(vol = 0.50) {
  const ac = getSharedAC()
  if (!ac) return
  const now = getSoundStartTime(0.60)

  // Rising whoosh — filtered noise sweep
  const bufLen = Math.floor(ac.sampleRate * 0.55)
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1
  const nSrc = ac.createBufferSource()
  nSrc.buffer = buf
  const bpf = ac.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.setValueAtTime(200, now)
  bpf.frequency.exponentialRampToValueAtTime(1400, now + 0.38)
  bpf.Q.value = 0.9
  const wGain = ac.createGain()
  wGain.gain.setValueAtTime(0, now)
  wGain.gain.linearRampToValueAtTime(vol * 0.50, now + 0.06)
  wGain.gain.setValueAtTime(vol * 0.50, now + 0.30)
  wGain.gain.linearRampToValueAtTime(0, now + 0.52)
  nSrc.connect(bpf); bpf.connect(wGain); wGain.connect(ac.destination)
  nSrc.start(now)

  // Spin rattle — amplitude-modulated sawtooth (net spinning in air)
  const spin = ac.createOscillator()
  const lfo  = ac.createOscillator()
  const spinGain = ac.createGain()
  const lfoGain  = ac.createGain()
  spin.type = 'sawtooth'
  spin.frequency.setValueAtTime(880, now)
  spin.frequency.exponentialRampToValueAtTime(1320, now + 0.38)
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(14, now)
  lfo.frequency.exponentialRampToValueAtTime(24, now + 0.38)
  lfoGain.gain.value = vol * 0.10
  spinGain.gain.value = vol * 0.10
  lfo.connect(lfoGain); lfoGain.connect(spinGain.gain)
  spin.connect(spinGain); spinGain.connect(ac.destination)
  spin.start(now); spin.stop(now + 0.42)
  lfo.start(now);  lfo.stop(now + 0.42)

  // Bass thud on landing
  const t = now + 0.38
  const thud = ac.createOscillator()
  const tGain = ac.createGain()
  thud.type = 'sine'
  thud.frequency.setValueAtTime(85, t)
  thud.frequency.exponentialRampToValueAtTime(35, t + 0.18)
  tGain.gain.setValueAtTime(vol * 0.70, t)
  tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.20)
  thud.connect(tGain); tGain.connect(ac.destination)
  thud.start(t); thud.stop(t + 0.22)

}

// ── Catch failed ──────────────────────────────────────────────────────────────
// Three shake clunks + descending sad wail + low rumble as net breaks open
export function playCatchFail(vol = 0.50) {
  const ac = getSharedAC()
  if (!ac) return
  const now = getSoundStartTime(0.90)

  // Three quick shake clunks
  ;[0, 0.10, 0.20].forEach((delay, i) => {
    const t = now + delay
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(260 - i * 30, t)
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.07)
    g.gain.setValueAtTime(vol * (0.45 - i * 0.08), t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    osc.connect(g); g.connect(ac.destination)
    osc.start(t); osc.stop(t + 0.10)
  })

  // Descending "fail" wail
  const wail  = ac.createOscillator()
  const wGain = ac.createGain()
  wail.type = 'sine'
  wail.frequency.setValueAtTime(420, now + 0.26)
  wail.frequency.exponentialRampToValueAtTime(175, now + 0.82)
  wGain.gain.setValueAtTime(0, now + 0.26)
  wGain.gain.linearRampToValueAtTime(vol * 0.35, now + 0.32)
  wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.86)
  wail.connect(wGain); wGain.connect(ac.destination)
  wail.start(now + 0.26); wail.stop(now + 0.88)

  // Low sawtooth rumble as creature breaks free
  const rumble  = ac.createOscillator()
  const rGain   = ac.createGain()
  rumble.type = 'sawtooth'
  rumble.frequency.setValueAtTime(55, now + 0.15)
  rumble.frequency.exponentialRampToValueAtTime(28, now + 0.40)
  rGain.gain.setValueAtTime(vol * 0.30, now + 0.15)
  rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
  rumble.connect(rGain); rGain.connect(ac.destination)
  rumble.start(now + 0.15); rumble.stop(now + 0.44)

}

// ── Catch success ─────────────────────────────────────────────────────────────
// G-major ascending arpeggio + sparkle chimes + held chord: creature caught!
export function playCatchSuccess(vol = 0.55) {
  const ac = getSharedAC()
  if (!ac) return
  const now = getSoundStartTime(1.40)

  // Ascending G major arpeggio (G4 B4 D5 G5)
  const arp = [196.00, 246.94, 293.66, 392.00]
  arp.forEach((freq, i) => {
    const t = now + i * 0.09
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.22, t + 0.015)
    g.gain.setValueAtTime(vol * 0.22, t + 0.07)
    g.gain.linearRampToValueAtTime(0, t + 0.13)
    osc.connect(g); g.connect(ac.destination)
    osc.start(t); osc.stop(t + 0.14)
  })

  // Sparkle chimes — high sine bursts staggered upward
  ;[1046.5, 1318.5, 1568.0, 2093.0].forEach((freq, i) => {
    const t = now + 0.36 + i * 0.07
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.24, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    osc.connect(g); g.connect(ac.destination)
    osc.start(t); osc.stop(t + 0.30)
  })

  // Held final G major chord (G4 + D5 + G5)
  ;[196.00, 293.66, 392.00].forEach((freq, i) => {
    const t = now + 0.70
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const pk = vol * (0.18 - i * 0.02)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(pk, t + 0.04)
    g.gain.setValueAtTime(pk, t + 0.36)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.65)
    osc.connect(g); g.connect(ac.destination)
    osc.start(t); osc.stop(t + 0.70)
  })

}
