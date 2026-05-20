/**
 * Master bus — per-AudioContext singleton.
 *
 * Music/loops and battle intros should connect to getMasterBus(ac) instead
 * of ac.destination. SFX one-shots (catch, hatch, events, ui, attack, enigma)
 * deliberately stay on ac.destination so their volume isn't gated by the
 * music compressor — they're already tuned individually.
 *
 * Signal chain:
 *
 *   input → soft tanh saturator (2× oversample) → musical compressor
 *         → makeup gain → brick-wall limiter → ac.destination
 *
 * Why each stage:
 *   - Saturator (WaveShaperNode, tanh curve, oversampled to avoid aliasing)
 *     adds even-order harmonics on loud transients → warmth, perceived
 *     loudness, no harsh digital clipping.
 *   - Compressor (ratio 3.5:1, knee 6 dB) glues stacked layers (lead + pad
 *     + drums + reverb send) into one cohesive mix.
 *   - Limiter (ratio 20:1, 1 ms attack) prevents clipping on extreme stacks
 *     (boss intro hit + chord swell + reverb tail + side-chain pump).
 *
 * Cache is keyed by AudioContext via WeakMap so multiple loops sharing one
 * AC share one bus, and the entry is automatically GC'd if the AC is freed.
 */

const cache = new WeakMap<AudioContext, GainNode>()

function makeTanhCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048
  const curve = new Float32Array(new ArrayBuffer(n * 4))
  const norm = Math.tanh(amount)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(amount * x) / norm
  }
  return curve
}

function build(ac: AudioContext): GainNode {
  const input = ac.createGain()
  input.gain.value = 1.0

  const saturator = ac.createWaveShaper()
  saturator.curve = makeTanhCurve(2.2)
  saturator.oversample = '2x'

  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 6
  comp.ratio.value = 3.5
  comp.attack.value = 0.005
  comp.release.value = 0.12

  const makeup = ac.createGain()
  makeup.gain.value = 1.35

  const limiter = ac.createDynamicsCompressor()
  limiter.threshold.value = -2
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.05

  input.connect(saturator)
  saturator.connect(comp)
  comp.connect(makeup)
  makeup.connect(limiter)
  limiter.connect(ac.destination)

  return input
}

/**
 * Return the input node of the master bus for this AudioContext. Lazily
 * built on first call; cached for the AC's lifetime.
 */
export function getMasterBus(ac: AudioContext): GainNode {
  let bus = cache.get(ac)
  if (!bus) {
    bus = build(ac)
    cache.set(ac, bus)
  }
  return bus
}
