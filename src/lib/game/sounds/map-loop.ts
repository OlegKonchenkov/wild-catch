/**
 * Map background ambience — synthesized via Web Audio API.
 * Plays continuously in a loop while the player is on the map screen.
 *
 * Layers:
 *   - Soft drone: two slightly detuned sine oscillators with slow LFO breath
 *   - Wind layer: looping bandpass-filtered white noise
 *   - Occasional bird-like chirps at random intervals (3–10 s)
 *
 * Usage:
 *   const stop = startMapAmbience()
 *   // on unmount:
 *   stop()
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

  // ── Soft ambient drone ────────────────────────────────────────────────────
  // Two slightly detuned oscillators create a gentle beating effect
  const drone1 = actx.createOscillator()
  const drone2 = actx.createOscillator()
  const droneGain = actx.createGain()
  drone1.type = 'sine'
  drone2.type = 'sine'
  drone1.frequency.value = 110.0
  drone2.frequency.value = 110.7  // ~0.7 Hz beat frequency → very slow pulse
  droneGain.gain.value = vol * 0.50
  drone1.connect(droneGain)
  drone2.connect(droneGain)
  droneGain.connect(actx.destination)
  drone1.start()
  drone2.start()

  // Slow LFO that breathes the drone volume (0.07 Hz → ~14 s cycle)
  const lfo = actx.createOscillator()
  const lfoGain = actx.createGain()
  lfo.type = 'sine'
  lfo.frequency.value = 0.07
  lfoGain.gain.value = vol * 0.35
  lfo.connect(lfoGain)
  lfoGain.connect(droneGain.gain)
  lfo.start()

  // ── Wind layer ────────────────────────────────────────────────────────────
  // Looping white noise through a bandpass filter at ~380 Hz
  const windLen = actx.sampleRate * 4
  const windBuf = actx.createBuffer(1, windLen, actx.sampleRate)
  const windData = windBuf.getChannelData(0)
  for (let i = 0; i < windLen; i++) windData[i] = Math.random() * 2 - 1
  const windSrc = actx.createBufferSource()
  windSrc.buffer = windBuf
  windSrc.loop = true
  const windBpf = actx.createBiquadFilter()
  windBpf.type = 'bandpass'
  windBpf.frequency.value = 380
  windBpf.Q.value = 0.6
  const windGain = actx.createGain()
  windGain.gain.value = vol * 0.18
  windSrc.connect(windBpf)
  windBpf.connect(windGain)
  windGain.connect(actx.destination)
  windSrc.start()

  // ── Occasional bird-like chirps ───────────────────────────────────────────
  // Random sine chirp every 3–10 seconds, pitched 1200–2000 Hz
  function scheduleChirp() {
    if (stopped) return
    const delay = 3000 + Math.random() * 7000
    const t = setTimeout(() => {
      if (stopped) return
      const now = actx.currentTime
      const freq = 1200 + Math.random() * 800
      const osc = actx.createOscillator()
      const g   = actx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.28, now + 0.05)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.82, now + 0.13)
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(vol * 0.55, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
      osc.connect(g)
      g.connect(actx.destination)
      osc.start(now)
      osc.stop(now + 0.18)
      scheduleChirp()
    }, delay)
    timers.push(t)
  }
  scheduleChirp()

  // ── Stop function ─────────────────────────────────────────────────────────
  return () => {
    stopped = true
    timers.forEach(t => clearTimeout(t))
    try { drone1.stop() } catch { /* already stopped */ }
    try { drone2.stop() } catch { /* already stopped */ }
    try { lfo.stop()    } catch { /* already stopped */ }
    try { windSrc.stop() } catch { /* already stopped */ }
    actx.close().catch(() => {})
  }
}
