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
 * Plucked-string voice — additive synthesis with a pluck envelope.
 *
 * NOT Karplus-Strong: the K-S delay-line approach relies on DelayNode delays
 * smaller than Chrome's 128-sample render quantum (~2.9 ms at 44.1 kHz),
 * which doesn't work for notes above ~344 Hz — they all get clamped to the
 * same wrong pitch. The previous attempt at K-S broke the entire melody
 * range. This version is simpler and produces correct pitches everywhere:
 *
 *   - Triangle fundamental (body) with a 1.2% pitch glide at the attack
 *     (mimics string tension stabilising)
 *   - 2nd harmonic sine (warmth)
 *   - 3rd harmonic sine (shimmer, very low gain)
 *   - Pluck envelope: fast attack (3 ms), sharp drop in first 80 ms,
 *     exponential decay through the rest of `dur`
 *
 * Sounds like a soft plectrum pluck — not a perfect mandolin, but
 * consistently musical at every frequency.
 */
export function pluckString(
  ac: AudioContext,
  freq: number,
  t: number,
  dur: number,
  vol: number,
  dest: AudioNode,
): void {
  const out = ac.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(vol, t + 0.003)
  out.gain.exponentialRampToValueAtTime(vol * 0.40, t + 0.08)
  out.gain.exponentialRampToValueAtTime(0.001, t + dur)
  out.connect(dest)

  // Fundamental — triangle with a tiny pitch glide at attack
  const o1 = ac.createOscillator()
  o1.type = 'triangle'
  o1.frequency.setValueAtTime(freq * 1.012, t)
  o1.frequency.exponentialRampToValueAtTime(freq, t + 0.020)
  const g1 = ac.createGain(); g1.gain.value = 1.0
  o1.connect(g1); g1.connect(out)
  o1.start(t); o1.stop(t + dur + 0.05)

  // 2nd harmonic — sine
  const o2 = ac.createOscillator()
  o2.type = 'sine'; o2.frequency.value = freq * 2
  const g2 = ac.createGain(); g2.gain.value = 0.32
  o2.connect(g2); g2.connect(out)
  o2.start(t); o2.stop(t + dur + 0.05)

  // 3rd harmonic — sine, very soft for shimmer
  const o3 = ac.createOscillator()
  o3.type = 'sine'; o3.frequency.value = freq * 3
  const g3 = ac.createGain(); g3.gain.value = 0.10
  o3.connect(g3); g3.connect(out)
  o3.start(t); o3.stop(t + dur + 0.05)
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
