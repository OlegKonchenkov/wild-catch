/**
 * Multi-layer drum synthesis. Replaces the naked sine-kick + noise-snare in
 * the previous battle loop with kit pieces that actually have weight.
 *
 * Each piece is built from 2-3 layers stacked at the same trigger time:
 *
 *   kick  = sub sine + body pitch-drop + click transient
 *   snare = noise bandpass + body tone with pitch drop + high crack
 *   hihat = 6 square oscillators at INHARMONIC ratios (modes of a metal disc)
 *           through HPF/BPF — that's what makes a cymbal sound like a cymbal
 *           rather than "tsss" filtered white noise
 *   tom   = sine pitch sweep + soft noise body
 *
 * Side-chain pumping:
 *   schedulePump(gainNode, t, depth, releaseS) momentarily dips the gain of
 *   a pad/melody node when a kick fires, giving the mix that "breathing"
 *   feel found in cinematic and modern game music. Call it from your loop
 *   scheduler right after each kick().
 */

/**
 * Multi-layer kick.
 *
 *   sub:   sine 60 Hz, gentle decay (~250 ms) — the felt thump
 *   body:  sine 110 → 38 Hz pitch sweep (~140 ms) — the pitched punch
 *   click: noise burst through 3 kHz highpass, ~5 ms — the attack snap
 *
 * All three peak at `t` so the kick lands with a single transient.
 */
export function kick(ac: AudioContext, t: number, vol: number, dest: AudioNode): void {
  // Sub sine
  const sub = ac.createOscillator()
  const subG = ac.createGain()
  sub.type = 'sine'
  sub.frequency.value = 60
  subG.gain.setValueAtTime(vol * 0.85, t)
  subG.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  sub.connect(subG); subG.connect(dest)
  sub.start(t); sub.stop(t + 0.28)

  // Body with pitch drop
  const body = ac.createOscillator()
  const bodyG = ac.createGain()
  body.type = 'sine'
  body.frequency.setValueAtTime(110, t)
  body.frequency.exponentialRampToValueAtTime(38, t + 0.14)
  bodyG.gain.setValueAtTime(vol * 1.0, t)
  bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
  body.connect(bodyG); bodyG.connect(dest)
  body.start(t); body.stop(t + 0.18)

  // Click transient
  const clickLen = Math.floor(ac.sampleRate * 0.006)
  const clickBuf = ac.createBuffer(1, clickLen, ac.sampleRate)
  const cd = clickBuf.getChannelData(0)
  for (let i = 0; i < clickLen; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / clickLen)
  const click = ac.createBufferSource()
  click.buffer = clickBuf
  const hpf = ac.createBiquadFilter()
  hpf.type = 'highpass'
  hpf.frequency.value = 3000
  const clickG = ac.createGain()
  clickG.gain.value = vol * 0.45
  click.connect(hpf); hpf.connect(clickG); clickG.connect(dest)
  click.start(t); click.stop(t + 0.01)
}

/**
 * Multi-layer snare.
 *
 *   body:  sine 180 → 100 Hz drop, ~80 ms — pitched fundamental
 *   noise: white noise through bandpass 800-3500 Hz, ~120 ms — wire snares
 *   crack: triangle 4500 Hz, ~25 ms — high transient
 */
export function snare(ac: AudioContext, t: number, vol: number, dest: AudioNode): void {
  // Body
  const body = ac.createOscillator()
  const bodyG = ac.createGain()
  body.type = 'sine'
  body.frequency.setValueAtTime(180, t)
  body.frequency.exponentialRampToValueAtTime(100, t + 0.06)
  bodyG.gain.setValueAtTime(vol * 0.55, t)
  bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
  body.connect(bodyG); bodyG.connect(dest)
  body.start(t); body.stop(t + 0.10)

  // Noise bandpass — wire snare rattle
  const len = Math.floor(ac.sampleRate * 0.12)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.8)
  const src = ac.createBufferSource()
  src.buffer = buf
  const bpf = ac.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.value = 1800
  bpf.Q.value = 0.6
  const noiseG = ac.createGain()
  noiseG.gain.value = vol * 0.85
  src.connect(bpf); bpf.connect(noiseG); noiseG.connect(dest)
  src.start(t); src.stop(t + 0.13)

  // High crack — defines the attack clearly
  const crack = ac.createOscillator()
  const crackG = ac.createGain()
  crack.type = 'triangle'
  crack.frequency.value = 4500
  crackG.gain.setValueAtTime(vol * 0.40, t)
  crackG.gain.exponentialRampToValueAtTime(0.001, t + 0.025)
  crack.connect(crackG); crackG.connect(dest)
  crack.start(t); crack.stop(t + 0.03)
}

/**
 * Inharmonic hihat — 6 square oscillators at the (approximate) ratios of
 * the bending modes of a thin metal disc:
 *     1.000, 1.342, 1.681, 1.928, 2.193, 2.461
 * Filtered through a 7 kHz highpass + 8 kHz peaking bandpass with Q=4.
 *
 * These ratios are what gives a real cymbal its "tttssss" inharmonic
 * spectrum. Just filtering white noise (the previous approach) loses
 * the metallic character entirely.
 *
 * @param open  true → 200 ms decay (open hat). false → 35 ms (closed).
 */
export function hihat(ac: AudioContext, t: number, vol: number, dest: AudioNode, open = false): void {
  const decay = open ? 0.20 : 0.035
  const base = 320  // base of inharmonic stack (kHz partials follow ratios)
  const ratios = [1.000, 1.342, 1.681, 1.928, 2.193, 2.461]

  const out = ac.createGain()
  out.gain.setValueAtTime(vol, t)
  out.gain.exponentialRampToValueAtTime(0.001, t + decay)

  const hpf = ac.createBiquadFilter()
  hpf.type = 'highpass'
  hpf.frequency.value = 7000
  hpf.Q.value = 0.4

  const bpf = ac.createBiquadFilter()
  bpf.type = 'peaking'
  bpf.frequency.value = 8500
  bpf.Q.value = 4
  bpf.gain.value = 4

  for (const r of ratios) {
    const o = ac.createOscillator()
    o.type = 'square'
    o.frequency.value = base * r * 10  // shift to true cymbal range (3-8 kHz)
    const g = ac.createGain()
    g.gain.value = 1 / ratios.length
    o.connect(g); g.connect(hpf)
    o.start(t); o.stop(t + decay + 0.02)
  }
  hpf.connect(bpf)
  bpf.connect(out)
  out.connect(dest)
}

/**
 * Tom — sine pitch sweep + soft low-passed noise body.
 *
 * @param freq  Starting frequency in Hz (e.g. 180 = floor tom, 280 = mid).
 *              Sweeps to freq * 0.45 over 200 ms.
 */
export function tom(ac: AudioContext, t: number, freq: number, vol: number, dest: AudioNode): void {
  const body = ac.createOscillator()
  const bodyG = ac.createGain()
  body.type = 'sine'
  body.frequency.setValueAtTime(freq, t)
  body.frequency.exponentialRampToValueAtTime(freq * 0.45, t + 0.20)
  bodyG.gain.setValueAtTime(vol * 0.9, t)
  bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
  body.connect(bodyG); bodyG.connect(dest)
  body.start(t); body.stop(t + 0.24)

  // Soft noise body — adds "skin" character
  const len = Math.floor(ac.sampleRate * 0.10)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6)
  const src = ac.createBufferSource()
  src.buffer = buf
  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = 800
  const noiseG = ac.createGain()
  noiseG.gain.value = vol * 0.22
  src.connect(lpf); lpf.connect(noiseG); noiseG.connect(dest)
  src.start(t); src.stop(t + 0.11)
}

/**
 * Schedule a side-chain ducking dip on a gain node, synchronised with a
 * drum hit. Creates the "pumping" feel where pads breathe under the kick.
 *
 * The gain is multiplied by (1 - depth) at the trigger time, then ramped
 * back to its base value over `releaseS` seconds. The gain node's intrinsic
 * value before the call is treated as the "rest" value to return to.
 *
 * Caller controls how often this fires — typically you call it for every
 * kick on beat 1 of each bar, sometimes also on beat 3.
 */
export function schedulePump(
  gainNode: GainNode,
  ac: AudioContext,
  t: number,
  depth = 0.45,
  releaseS = 0.18,
): void {
  const baseVal = gainNode.gain.value
  const duckTo  = baseVal * (1 - depth)
  // Cancel any in-flight automations so successive pumps stack cleanly
  gainNode.gain.cancelScheduledValues(t - 0.001)
  gainNode.gain.setValueAtTime(baseVal, t - 0.001)
  // Fast attack (3 ms) into duck
  gainNode.gain.linearRampToValueAtTime(duckTo, t + 0.003)
  // Hold briefly so the dip is perceived as a "duck" not a "click"
  gainNode.gain.setValueAtTime(duckTo, t + 0.025)
  // Release back to base
  gainNode.gain.linearRampToValueAtTime(baseVal, t + 0.025 + releaseS)
}
