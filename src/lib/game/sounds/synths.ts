/**
 * Higher-level synth voices used by the music loops.
 *
 * All voices accept a `dest: AudioNode` so callers can route through the
 * master bus, a reverb send, a side-chain pump gain, or any combination.
 *
 * Voices:
 *   pluckString(freq, t, dur, vol, dest)  — Karplus-Strong plucked string
 *                                            (mandolino/chitarra-like timbre)
 *   pad(freqs[], t, dur, vol, dest)       — multi-detuned saw + LFO filter
 *                                            (analog-style sustained chord)
 *   fmBell(freq, t, dur, vol, dest)       — 2-op FM with modulator envelope
 *                                            (inharmonic metallic bell)
 *
 * Stereo helpers:
 *   haasWidth(dest, sideMs, panAmount)    — return a node pair: connect a
 *                                            mono source to .input; routes
 *                                            to L and a delayed R (or vice
 *                                            versa) into `dest`. Cheap
 *                                            psycho-acoustic stereo width.
 */

/**
 * Karplus-Strong plucked-string synthesis.
 *
 * Algorithm:
 *   1. Excite a delay line of length 1/freq with a short noise burst.
 *   2. Feed the delay output through a 1st-order lowpass (sets brightness
 *      decay) and back into the delay input with feedback gain ≈ 0.985.
 *   3. The recirculating noise burst becomes a decaying harmonic spectrum
 *      that closely models a pluck.
 *
 * Caveats:
 *   - DelayNode minimum delay is implementation-dependent (~one render
 *     quantum on Chrome ≈ 0.7 ms). For freq > ~1500 Hz we fall back to a
 *     simpler triangle voice to avoid timing artefacts.
 */
export function pluckString(
  ac: AudioContext,
  freq: number,
  t: number,
  dur: number,
  vol: number,
  dest: AudioNode,
): void {
  // Fallback for very high frequencies where the K-S delay is too short.
  if (freq > 1500) {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'triangle'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g); g.connect(dest)
    o.start(t); o.stop(t + dur + 0.03)
    return
  }

  const delayTime = 1 / freq

  // 4 ms exciter noise burst — clipped to the pluck attack
  const burstLen = Math.max(32, Math.floor(ac.sampleRate * 0.004))
  const burstBuf = ac.createBuffer(1, burstLen, ac.sampleRate)
  const bd = burstBuf.getChannelData(0)
  for (let i = 0; i < burstLen; i++) {
    bd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / burstLen, 0.5)
  }
  const burst = ac.createBufferSource()
  burst.buffer = burstBuf

  const delay = ac.createDelay(0.05)
  delay.delayTime.value = delayTime

  // Damping LPF in feedback loop — controls timbre decay rate
  const damp = ac.createBiquadFilter()
  damp.type = 'lowpass'
  damp.frequency.value = Math.min(8000, freq * 6 + 1500)
  damp.Q.value = 0.5

  // Feedback gain — sets sustain length; 0.985 gives ~2-3s natural decay,
  // we scale via envelope to allow shorter `dur` values
  const feedback = ac.createGain()
  feedback.gain.value = 0.985

  // Output envelope (multiplies the recirculating signal so the caller can
  // request a shorter pluck without changing the feedback gain)
  const out = ac.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(vol, t + 0.005)
  out.gain.setValueAtTime(vol, t + Math.max(0.02, dur * 0.55))
  out.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05)

  // Graph: burst → delay → damp → out → dest
  //                  ↑          │
  //                  └─feedback─┘
  burst.connect(delay)
  delay.connect(damp)
  damp.connect(feedback)
  feedback.connect(delay)
  damp.connect(out)
  out.connect(dest)

  burst.start(t); burst.stop(t + 0.05)

  // Schedule cleanup ramp to silence the feedback loop so it doesn't ring
  // forever (the gain envelope mutes it, but we also want the AudioParam
  // automations to release the underlying nodes for GC).
  feedback.gain.setValueAtTime(0.985, t + dur)
  feedback.gain.linearRampToValueAtTime(0, t + dur + 0.4)
}

/**
 * Analog-style pad: 3 detuned sawtooth oscillators through a lowpass filter
 * whose cutoff is modulated by a slow LFO (gives the chord "movement" so
 * it doesn't sound static across a long sustain).
 *
 * Use for chord beds beneath melodies. Volume is intentionally low because
 * pads sit in the same midrange as leads and clash easily; let the lead
 * dominate and the pad fill the gaps.
 */
export function pad(
  ac: AudioContext,
  freqs: number[],
  t: number,
  dur: number,
  vol: number,
  dest: AudioNode,
): void {
  const out = ac.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(vol, t + Math.min(0.4, dur * 0.25))
  out.gain.setValueAtTime(vol, t + dur * 0.78)
  out.gain.linearRampToValueAtTime(0, t + dur)

  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = 1100
  lpf.Q.value = 0.8

  // LFO modulates the cutoff between 800 and 2200 Hz over ~3.3 s
  const lfo = ac.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 0.3
  const lfoDepth = ac.createGain()
  lfoDepth.gain.value = 700  // ± Hz around the lpf base frequency (1100)
  lfo.connect(lfoDepth)
  lfoDepth.connect(lpf.frequency)
  lfo.start(t); lfo.stop(t + dur + 0.3)

  lpf.connect(out)
  out.connect(dest)

  // 3 saw voices per freq: detune -9 cents, 0, +9 cents — wide and warm
  for (const freq of freqs) {
    for (const cents of [-9, 0, 9]) {
      const o = ac.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = freq
      o.detune.value = cents
      o.connect(lpf)
      o.start(t)
      o.stop(t + dur + 0.05)
    }
  }
}

/**
 * 2-operator FM synthesis bell. Carrier sine is frequency-modulated by a
 * second sine at `freq * ratio`. Modulation index has its own envelope:
 * starts high (lots of inharmonic partials = metallic ping attack) then
 * decays fast (settles into a near-sine sustain = "bell body").
 *
 * Sounds genuinely metallic — much closer to a real glockenspiel/celesta
 * than stacked sines or triangle waves.
 */
export function fmBell(
  ac: AudioContext,
  freq: number,
  t: number,
  dur: number,
  vol: number,
  dest: AudioNode,
): void {
  // Carrier
  const carrier = ac.createOscillator()
  carrier.type = 'sine'
  carrier.frequency.value = freq

  // Modulator at 3.5× ratio (gives clear bell-like inharmonic signature;
  // ratios of 1.4, 2, 3.5, 7 are all classic "bell" choices in FM lore)
  const modulator = ac.createOscillator()
  modulator.type = 'sine'
  modulator.frequency.value = freq * 3.5

  // Modulator depth envelope: high at attack, decays fast — gives the
  // characteristic "pingy" inharmonic attack that settles to a clean tone.
  const modDepth = ac.createGain()
  modDepth.gain.setValueAtTime(freq * 5, t)
  modDepth.gain.exponentialRampToValueAtTime(freq * 0.6, t + 0.18)
  modDepth.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur)
  modulator.connect(modDepth)
  modDepth.connect(carrier.frequency)

  // Amplitude envelope
  const out = ac.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(vol, t + 0.008)
  out.gain.exponentialRampToValueAtTime(0.001, t + dur)

  carrier.connect(out)
  out.connect(dest)

  carrier.start(t);   carrier.stop(t + dur + 0.05)
  modulator.start(t); modulator.stop(t + dur + 0.05)
}

/**
 * Haas-effect stereo widener. Returns { input } — connect a mono source to
 * `input` and the splitter routes:
 *   - direct path  → pan = -panAmount  (left-heavy)
 *   - delayed path → pan = +panAmount, with `sideMs` of delay (right-heavy)
 *
 * The brain perceives this as "wider" because of the inter-aural time
 * difference, even at small delays (5-15 ms). Below ~30 ms it doesn't
 * register as a discrete echo; above ~40 ms it does.
 *
 * The output already goes to `dest`. You typically use the master bus as
 * dest, but a reverb send works too.
 */
export function haasWidth(
  ac: AudioContext,
  dest: AudioNode,
  sideMs = 12,
  panAmount = 0.7,
): { input: GainNode } {
  const input = ac.createGain()
  input.gain.value = 1

  const left  = ac.createStereoPanner(); left.pan.value  = -panAmount
  const right = ac.createStereoPanner(); right.pan.value =  panAmount

  const delay = ac.createDelay(0.1)
  delay.delayTime.value = sideMs / 1000

  // Direct → L
  input.connect(left)
  left.connect(dest)
  // Delayed → R
  input.connect(delay)
  delay.connect(right)
  right.connect(dest)

  return { input }
}
