/**
 * Map background ambience — enchanted forest feel, synthesized via Web Audio API.
 * Plays continuously while the player is on the map screen.
 *
 * Layers:
 *   - Deep magic drone: 55 Hz + 82.5 Hz (perfect 5th), slow LFO breath
 *   - Cricket texture: 3 AM-modulated sine oscillators (no white noise)
 *   - Magical shimmer: very quiet high-frequency sines (C pentatonic oct 6/7)
 *   - Random chimes: bell-like tones from C major pentatonic, every 7–20 s
 *   - Rare bird call: occasional soft chirp every 12–30 s
 */

export function startMapAmbience(vol = 0.12): () => void {
  if (typeof window === 'undefined') return () => {}

  let ac: AudioContext | null = null
  let stopped = false
  const timers: ReturnType<typeof setTimeout>[] = []

  try {
    ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
  } catch {
    return () => {}
  }

  if (!ac) return () => {}
  const actx: AudioContext = ac

  // Track all oscillators for clean shutdown
  const allOscs: OscillatorNode[] = []

  function osc(freq: number, type: OscillatorType = 'sine'): OscillatorNode {
    const o = actx.createOscillator()
    o.type = type
    o.frequency.value = freq
    allOscs.push(o)
    return o
  }

  // ── Deep magic drone (55 Hz + 82.5 Hz perfect 5th) ────────────────────────
  const drone1  = osc(55.0)
  const drone2  = osc(82.5)
  const droneG  = actx.createGain()
  droneG.gain.value = vol * 0.55
  drone1.connect(droneG)
  drone2.connect(droneG)
  droneG.connect(actx.destination)
  drone1.start(); drone2.start()

  // Slow LFO breathes the drone (0.035 Hz = ~28 s cycle)
  const droneLfo  = osc(0.035)
  const droneLfoG = actx.createGain()
  droneLfoG.gain.value = vol * 0.28
  droneLfo.connect(droneLfoG)
  droneLfoG.connect(droneG.gain)
  droneLfo.start()

  // ── Cricket texture — amplitude-modulated sines ────────────────────────────
  // Each cricket oscillator is modulated by a fast LFO (~20 Hz) to produce
  // the on-off chirp pattern.  No white noise = no "radio static" sound.
  const cricketFreqs = [3380, 3640, 3820]
  const cricketLfos  = [19.2, 20.8, 22.1]
  cricketFreqs.forEach((freq, i) => {
    const cricOsc  = osc(freq)
    const cricG    = actx.createGain()
    cricG.gain.value = vol * 0.022              // DC offset
    const lfo      = osc(cricketLfos[i])
    const lfoG     = actx.createGain()
    lfoG.gain.value = vol * 0.020               // AM depth ≈ 100 %
    lfo.connect(lfoG)
    lfoG.connect(cricG.gain)
    cricOsc.connect(cricG)
    cricG.connect(actx.destination)
    cricOsc.start(); lfo.start()
  })

  // ── Magical shimmer — very quiet high sines (C pentatonic oct 6/7) ─────────
  const shimmerFreqs = [1046.5, 1318.5, 1568.0, 2093.0]
  shimmerFreqs.forEach((freq, i) => {
    const shOsc  = osc(freq + i * 0.3)          // tiny per-partial detune
    const shG    = actx.createGain()
    shG.gain.value = vol * 0.010
    const lfo    = osc(0.08 + i * 0.02)         // 0.08–0.14 Hz slow modulation
    const lfoG   = actx.createGain()
    lfoG.gain.value = vol * 0.008
    lfo.connect(lfoG)
    lfoG.connect(shG.gain)
    shOsc.connect(shG)
    shG.connect(actx.destination)
    shOsc.start(); lfo.start()
  })

  // ── Random magic chimes — C major pentatonic bell tones ───────────────────
  const chimeNotes = [523.25, 659.25, 783.99, 880.0, 1046.5, 1318.5, 1567.98]

  function scheduleChime() {
    if (stopped) return
    const delay = 7000 + Math.random() * 13000  // every 7–20 s
    const t = setTimeout(() => {
      if (stopped) return
      const now  = actx.currentTime
      const base = Math.floor(Math.random() * (chimeNotes.length - 2))
      const cnt  = 2 + Math.floor(Math.random() * 2) // 2–3 ascending notes
      for (let j = 0; j < cnt; j++) {
        const freq     = chimeNotes[base + j]
        const chimeOsc = actx.createOscillator()
        const chimeG   = actx.createGain()
        chimeOsc.type  = 'sine'
        chimeOsc.frequency.value = freq
        const t2 = now + j * 0.14
        chimeG.gain.setValueAtTime(0, t2)
        chimeG.gain.linearRampToValueAtTime(vol * (0.30 + j * 0.05), t2 + 0.015)
        chimeG.gain.exponentialRampToValueAtTime(0.001, t2 + 1.1)
        chimeOsc.connect(chimeG)
        chimeG.connect(actx.destination)
        chimeOsc.start(t2)
        chimeOsc.stop(t2 + 1.15)
      }
      scheduleChime()
    }, delay)
    timers.push(t)
  }
  scheduleChime()

  // ── Rare bird call — soft, gentler pitch range than before ────────────────
  function scheduleBird() {
    if (stopped) return
    const delay = 12000 + Math.random() * 18000  // every 12–30 s
    const t = setTimeout(() => {
      if (stopped) return
      const now  = actx.currentTime
      const freq = 900 + Math.random() * 500       // 900–1400 Hz (gentler range)
      const bOsc = actx.createOscillator()
      const bG   = actx.createGain()
      bOsc.type  = 'sine'
      bOsc.frequency.setValueAtTime(freq, now)
      bOsc.frequency.exponentialRampToValueAtTime(freq * 1.22, now + 0.06)
      bOsc.frequency.exponentialRampToValueAtTime(freq * 0.88, now + 0.14)
      bG.gain.setValueAtTime(0, now)
      bG.gain.linearRampToValueAtTime(vol * 0.40, now + 0.02)
      bG.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      bOsc.connect(bG)
      bG.connect(actx.destination)
      bOsc.start(now)
      bOsc.stop(now + 0.20)
      scheduleBird()
    }, delay)
    timers.push(t)
  }
  scheduleBird()

  // ── Stop function ─────────────────────────────────────────────────────────
  return () => {
    stopped = true
    timers.forEach(t => clearTimeout(t))
    allOscs.forEach(o => { try { o.stop() } catch { /* already stopped */ } })
    actx.close().catch(() => {})
  }
}
