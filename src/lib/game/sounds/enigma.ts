/**
 * Enigma solve sound — synthesized via Web Audio API.
 * Ancient lock clicks open → mystical D-minor pentatonic reveal → shimmer cascade.
 */

import { getSharedAC, getSoundStartTime } from './shared-ac'

export function playEnigmaSolve(vol = 0.55): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(2.8)

  // 1. Mechanical lock click — bandpass noise burst (tumblers snapping)
  const clickLen = Math.floor(ac.sampleRate * 0.045)
  const clickBuf = ac.createBuffer(1, clickLen, ac.sampleRate)
  const cd = clickBuf.getChannelData(0)
  for (let i = 0; i < clickLen; i++) cd[i] = Math.random() * 2 - 1
  const cSrc = ac.createBufferSource()
  cSrc.buffer = clickBuf
  const bpf = ac.createBiquadFilter()
  bpf.type = 'bandpass'; bpf.frequency.value = 2200; bpf.Q.value = 3.0
  const cG = ac.createGain()
  cG.gain.setValueAtTime(vol * 0.78, now)
  cG.gain.exponentialRampToValueAtTime(0.001, now + 0.045)
  cSrc.connect(bpf); bpf.connect(cG); cG.connect(ac.destination)
  cSrc.start(now); cSrc.stop(now + 0.05)

  // 2. Deep resonant gong — sine glide 110 Hz → 82 Hz
  const gong  = ac.createOscillator()
  const gongG = ac.createGain()
  gong.type = 'sine'
  gong.frequency.setValueAtTime(110, now + 0.01)
  gong.frequency.exponentialRampToValueAtTime(82, now + 0.72)
  gongG.gain.setValueAtTime(0, now)
  gongG.gain.linearRampToValueAtTime(vol * 0.50, now + 0.025)
  gongG.gain.exponentialRampToValueAtTime(0.001, now + 1.05)
  gong.connect(gongG); gongG.connect(ac.destination)
  gong.start(now); gong.stop(now + 1.08)

  // Metallic overtone (~3rd harmonic)
  const ovt  = ac.createOscillator()
  const ovtG = ac.createGain()
  ovt.type = 'sine'; ovt.frequency.value = 330
  ovtG.gain.setValueAtTime(0, now)
  ovtG.gain.linearRampToValueAtTime(vol * 0.12, now + 0.02)
  ovtG.gain.exponentialRampToValueAtTime(0.001, now + 0.40)
  ovt.connect(ovtG); ovtG.connect(ac.destination)
  ovt.start(now); ovt.stop(now + 0.42)

  // 3. Ascending D-minor pentatonic arpeggio: D4 F4 G4 A4 C5 D5
  ;[293.66, 349.23, 392.0, 440.0, 523.25, 587.33].forEach((freq, i) => {
    const t = now + 0.22 + i * 0.13
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'; o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.40, t + 0.018)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.58)
  })

  // 4. High shimmer cascade — D6 F6 A6 D7
  const shimStart = now + 0.22 + 6 * 0.13 + 0.04
  ;[1174.66, 1396.91, 1760.0, 2349.32].forEach((freq, i) => {
    const t = shimStart + i * 0.075
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'; o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.18, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.60)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.63)
  })

  // 5. Held D-major chord: D5 + F#5 + A5 (sustained resolution)
  const cs = now + 0.22 + 4 * 0.13
  ;[587.33, 739.99, 880.0].forEach(freq => {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'; o.frequency.value = freq
    g.gain.setValueAtTime(0, cs)
    g.gain.linearRampToValueAtTime(vol * 0.26, cs + 0.025)
    g.gain.setValueAtTime(vol * 0.26, cs + 0.68)
    g.gain.exponentialRampToValueAtTime(0.001, cs + 1.65)
    o.connect(g); g.connect(ac.destination)
    o.start(cs); o.stop(cs + 1.70)
  })
}
