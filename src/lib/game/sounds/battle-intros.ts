/**
 * Battle intro sounds — synthesized via Web Audio API.
 * No external files, no copyright concerns, works offline.
 *
 * playEncounterSound  — wild creature appears
 * playBattleSound     — PvP duel starts
 * playBossSound       — Boss / Capo Palestra fight starts
 */

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    return new ((window as any).AudioContext || (window as any).webkitAudioContext)()
  } catch { return null }
}

// ── Wild creature encounter ────────────────────────────────────────────────────
// Ascending arpeggio (C4→E4→G4→C5) over a soft whoosh: "something appeared!"
export function playEncounterSound(vol = 0.55) {
  const ac = ctx()
  if (!ac) return

  const now = ac.currentTime

  // Ascending arpeggio
  const notes = [261.63, 329.63, 392.00, 523.25] // C4 E4 G4 C5
  notes.forEach((freq, i) => {
    const t     = now + i * 0.1
    const osc   = ac.createOscillator()
    const gain  = ac.createGain()
    osc.type    = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(vol * 0.22, t + 0.015)
    gain.gain.setValueAtTime(vol * 0.22, t + 0.08)
    gain.gain.linearRampToValueAtTime(0, t + 0.14)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.15)
  })

  // Trailing shimmer on the last note — extra resonance
  const shimmer = ac.createOscillator()
  const sGain   = ac.createGain()
  shimmer.type  = 'sine'
  shimmer.frequency.setValueAtTime(1046.5, now + 0.32) // C6
  shimmer.frequency.exponentialRampToValueAtTime(523.25, now + 0.85)
  sGain.gain.setValueAtTime(0, now + 0.32)
  sGain.gain.linearRampToValueAtTime(vol * 0.18, now + 0.38)
  sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85)
  shimmer.connect(sGain)
  sGain.connect(ac.destination)
  shimmer.start(now + 0.32)
  shimmer.stop(now + 0.86)

  // Soft whoosh underneath
  const bufLen = Math.floor(ac.sampleRate * 0.75)
  const buf    = ac.createBuffer(1, bufLen, ac.sampleRate)
  const d      = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) {
    const env = Math.sin(Math.PI * i / bufLen)
    d[i] = (Math.random() * 2 - 1) * env * 0.55
  }
  const noise  = ac.createBufferSource()
  noise.buffer = buf
  const bpf    = ac.createBiquadFilter()
  bpf.type     = 'bandpass'
  bpf.frequency.setValueAtTime(800, now)
  bpf.frequency.exponentialRampToValueAtTime(3200, now + 0.4)
  bpf.frequency.exponentialRampToValueAtTime(600, now + 0.75)
  bpf.Q.value  = 1.4
  const wGain  = ac.createGain()
  wGain.gain.value = vol * 0.08
  noise.connect(bpf)
  bpf.connect(wGain)
  wGain.connect(ac.destination)
  noise.start(now)

  setTimeout(() => ac.close(), 1200)
}

// ── PvP Duel battle ────────────────────────────────────────────────────────────
// Deep impact thud + power chord + high ping ring: "BATTLE BEGINS!"
export function playBattleSound(vol = 0.55) {
  const ac = ctx()
  if (!ac) return

  const now = ac.currentTime

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

  setTimeout(() => ac.close(), 900)
}

// ── Boss / Capo Palestra ───────────────────────────────────────────────────────
// Double-hit power chord in C minor + dramatic sweep: "BOSS BATTLE!"
export function playBossSound(vol = 0.55) {
  const ac = ctx()
  if (!ac) return

  const now = ac.currentTime

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

  setTimeout(() => ac.close(), 1300)
}
