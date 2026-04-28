/**
 * Battle intro sounds — synthesized via Web Audio API.
 * No external files, no copyright concerns, works offline.
 *
 * playEncounterSound  — wild creature appears
 * playBattleSound     — PvP duel starts
 * playBossSound       — Boss / Capo Palestra fight starts
 */

import { getSharedAC, getSoundStartTime } from './shared-ac'

// ── Wild creature encounter ────────────────────────────────────────────────────
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
  // Timbre: sine fundamental + 2nd harmonic (warm) + slightly detuned 3rd (shimmer)
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

// ── PvP Duel battle ────────────────────────────────────────────────────────────
// Deep impact thud + power chord + high ping ring: "BATTLE BEGINS!"
export function playBattleSound(vol = 0.55) {
  const ac = getSharedAC()
  if (!ac) return

  const now = getSoundStartTime(0.7)

  // Sub bass thud
  const sub  = ac.createOscillator()
  const sGain = ac.createGain()
  sub.type   = 'sine'
  sub.frequency.setValueAtTime(90, now)
  sub.frequency.exponentialRampToValueAtTime(35, now + 0.28)
  sGain.gain.setValueAtTime(vol * 0.75, now)
  sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
  sub.connect(sGain); sGain.connect(ac.destination)
  sub.start(now); sub.stop(now + 0.3)

  // Power chord tones (G2 D3 G3 B3)
  const chord = [98.00, 146.83, 196.00, 246.94]
  chord.forEach((freq, i) => {
    const osc   = ac.createOscillator()
    const gain  = ac.createGain()
    osc.type    = 'sawtooth'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol * 0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + i * 0.04)
    osc.connect(gain); gain.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.65)
  })

  // High metallic ping
  const ping  = ac.createOscillator()
  const pGain = ac.createGain()
  ping.type   = 'sine'
  ping.frequency.setValueAtTime(1320, now + 0.02)
  ping.frequency.exponentialRampToValueAtTime(660, now + 0.45)
  pGain.gain.setValueAtTime(vol * 0.32, now + 0.02)
  pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
  ping.connect(pGain); pGain.connect(ac.destination)
  ping.start(now + 0.02); ping.stop(now + 0.56)

  // Noise burst at impact
  const nBufLen = Math.floor(ac.sampleRate * 0.1)
  const nBuf    = ac.createBuffer(1, nBufLen, ac.sampleRate)
  const nd      = nBuf.getChannelData(0)
  for (let i = 0; i < nBufLen; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nBufLen, 3)
  const nSrc  = ac.createBufferSource()
  nSrc.buffer = nBuf
  const nGain = ac.createGain()
  nGain.gain.value = vol * 0.65
  nSrc.connect(nGain); nGain.connect(ac.destination)
  nSrc.start(now)

}

// ── Boss / Capo Palestra ───────────────────────────────────────────────────────
// Double-hit power chord in C minor + dramatic sweep: "BOSS BATTLE!"
export function playBossSound(vol = 0.55) {
  const ac = getSharedAC()
  if (!ac) return

  const now = getSoundStartTime(1.0)

  // Double percussion hit (0ms + 110ms for drama)
  ;[0, 0.11].forEach((delay, hit) => {
    const t = now + delay

    const sub  = ac.createOscillator()
    const sG   = ac.createGain()
    sub.type   = 'sine'
    sub.frequency.setValueAtTime(hit === 0 ? 110 : 75, t)
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.3)
    sG.gain.setValueAtTime(vol * (hit === 0 ? 0.8 : 0.55), t)
    sG.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    sub.connect(sG); sG.connect(ac.destination)
    sub.start(t); sub.stop(t + 0.32)

    // C minor chord (C3 Eb3 G3 C4)
    ;[130.81, 155.56, 196.00, 261.63].forEach(freq => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      osc.type   = hit === 0 ? 'sawtooth' : 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(vol * 0.18, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75)
      osc.connect(gain); gain.connect(ac.destination)
      osc.start(t); osc.stop(t + 0.78)
    })
  })

  // Long dramatic sweep (high to mid)
  const sweep  = ac.createOscillator()
  const swGain = ac.createGain()
  sweep.type   = 'sine'
  sweep.frequency.setValueAtTime(1568, now + 0.08)  // G6
  sweep.frequency.exponentialRampToValueAtTime(392, now + 0.9) // G4
  swGain.gain.setValueAtTime(0, now + 0.08)
  swGain.gain.linearRampToValueAtTime(vol * 0.38, now + 0.15)
  swGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95)
  sweep.connect(swGain); swGain.connect(ac.destination)
  sweep.start(now + 0.08); sweep.stop(now + 0.96)

  // Double noise burst
  ;[0, 0.11].forEach(delay => {
    const t      = now + delay
    const bLen   = Math.floor(ac.sampleRate * 0.12)
    const buf    = ac.createBuffer(1, bLen, ac.sampleRate)
    const d      = buf.getChannelData(0)
    for (let i = 0; i < bLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bLen, 2.5)
    const src    = ac.createBufferSource()
    src.buffer   = buf
    const gain   = ac.createGain()
    gain.gain.value = vol * 0.7
    src.connect(gain); gain.connect(ac.destination)
    src.start(t)
  })

}
