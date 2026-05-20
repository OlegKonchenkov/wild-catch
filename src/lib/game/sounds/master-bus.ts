/**
 * Master bus — per-AudioContext singleton.
 *
 * Music/loops and battle intros should connect to getMasterBus(ac) instead
 * of ac.destination. SFX one-shots (catch, hatch, events, ui, attack, enigma)
 * deliberately stay on ac.destination so their volume isn't gated by the
 * music compressor — they're already tuned individually.
 *
 * Signal chain (intentionally minimal, post-incident calibration):
 *
 *   input → gentle compressor → makeup (1.0) → brick-wall limiter → destination
 *
 * The earlier version had a tanh saturator + aggressive comp + makeup 1.35 —
 * combined with the existing pads/leads this saturated the mix and produced
 * audible pumping. The new chain is "transparent glue": compressor with a
 * wide knee (12 dB) and modest ratio (2:1) only catches extreme peaks; the
 * limiter is purely a safety net.
 *
 * Cache is keyed by AudioContext via WeakMap so multiple loops sharing one
 * AC share one bus, and the entry is automatically GC'd if the AC is freed.
 */

const cache = new WeakMap<AudioContext, GainNode>()

function build(ac: AudioContext): GainNode {
  const input = ac.createGain()
  input.gain.value = 1.0

  // Gentle compressor — wide knee, modest ratio. Catches occasional peaks
  // without colouring the steady-state mix.
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -10
  comp.knee.value = 12
  comp.ratio.value = 2.0
  comp.attack.value = 0.010
  comp.release.value = 0.20

  // Brick-wall safety limiter — only activates near 0 dBFS to prevent
  // clipping on rare extreme stacks. Does nothing in normal playback.
  const limiter = ac.createDynamicsCompressor()
  limiter.threshold.value = -1
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.05

  input.connect(comp)
  comp.connect(limiter)
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
