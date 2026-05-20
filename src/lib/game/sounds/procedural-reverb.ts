/**
 * Procedural Schroeder reverb — no impulse response file, just a feedback
 * delay network synthesized live with native Web Audio nodes.
 *
 * Topology:
 *
 *   input ─┬─ comb₁ ─┐
 *          ├─ comb₂ ─┼─ combMix ─ allpass₁ ─ allpass₂ ─ wet → master bus
 *          ├─ comb₃ ─┤
 *          └─ comb₄ ─┘
 *
 *   each comb:   in → delay(D) → lowpass(damp) ─┬→ out
 *                       ↑                       └→ ×fb → back to delay in
 *
 *   each allpass:   in ──── ×(-g) ────────── + → out
 *                    │                       ↑
 *                    └─ sum → delay(D) ─┬───┘
 *                       ↑               └─ ×(+g) → back to sum
 *
 * The 4 parallel combs build the late-reflection cloud (each delay length
 * prime-ish to spread the comb peaks). Lowpass in the feedback loop simulates
 * air absorption → darker tail = more "spacious" room. The 2 series allpass
 * filters smear comb peaks into smooth diffusion so the tail doesn't sound
 * metallic.
 *
 * Two presets:
 *   - small      ≈ 1.2 s decay, brighter — encounter, mappa chimes
 *   - cathedral  ≈ 3.5 s decay, darker  — boss, enigma halo
 *
 * Created lazily on first send() and cached per AudioContext + preset.
 * Repeated callers share the same reverb instance (correct behaviour:
 * multiple sources mix into one tail).
 */

import { getMasterBus } from './master-bus'

export type ReverbPreset = 'small' | 'cathedral'

interface PresetConfig {
  combDelays:    [number, number, number, number]  // seconds
  combFeedback:  number                              // 0..0.95
  combDamping:   number                              // LPF Hz in feedback
  allpassDelays: [number, number]                    // seconds
  allpassG:      number                              // 0..0.85
  wetGain:       number                              // 0..1
}

// Calibrated low after the first attempt sounded too wet/unstable. Wet
// gains kept conservative (around 0.15-0.20) so reverb adds depth without
// turning the mix into a soup. Cathedral feedback brought below 0.80 for
// stability (0.86 was near comb-resonance threshold).
const PRESETS: Record<ReverbPreset, PresetConfig> = {
  small: {
    combDelays:    [0.0297, 0.0371, 0.0411, 0.0437],
    combFeedback:  0.68,
    combDamping:   4500,
    allpassDelays: [0.0051, 0.0117],
    allpassG:      0.7,
    wetGain:       0.15,
  },
  cathedral: {
    combDelays:    [0.0571, 0.0683, 0.0789, 0.0913],
    combFeedback:  0.78,
    combDamping:   2800,
    allpassDelays: [0.0073, 0.0149],
    allpassG:      0.72,
    wetGain:       0.20,
  },
}

interface ReverbCache {
  small?:     GainNode
  cathedral?: GainNode
}

// Per-AC cache used only when the caller routes reverb to the master bus
// (the default). Loops that want reverb routed through their own duck-gain
// must use createReverb(ac, preset, finalDest) directly so the wet tail
// also ducks with the dry signal.
const cache = new WeakMap<AudioContext, ReverbCache>()

/**
 * Schroeder allpass: out = -g·x + delay·(1-g²)·x + g·delay·prev_out
 *
 * Implementation note: we build it as two paths summed at `output`:
 *   - dryNeg:   x ── ×(-g) ── output
 *   - delayed:  x ── sumIn ── delay ── output    (and delay's tail loops back)
 *
 * Together they implement the standard Schroeder allpass transfer function,
 * which has flat magnitude response but disperses phase in time → smearing.
 */
function buildAllpass(ac: AudioContext, delayTime: number, g: number): { input: GainNode; output: GainNode } {
  const input  = ac.createGain(); input.gain.value  = 1
  const output = ac.createGain(); output.gain.value = 1

  const sumIn = ac.createGain(); sumIn.gain.value = 1
  const delay = ac.createDelay(0.1)
  delay.delayTime.value = delayTime

  const dryNeg  = ac.createGain(); dryNeg.gain.value  = -g
  const fbTap   = ac.createGain(); fbTap.gain.value   = g

  // x → sumIn → delay → output
  input.connect(sumIn)
  sumIn.connect(delay)
  delay.connect(output)
  // x → ×(-g) → output
  input.connect(dryNeg)
  dryNeg.connect(output)
  // delay → ×g → sumIn (feedback)
  delay.connect(fbTap)
  fbTap.connect(sumIn)

  return { input, output }
}

function buildReverb(ac: AudioContext, cfg: PresetConfig, finalDest: AudioNode): GainNode {
  const input = ac.createGain()
  input.gain.value = 1

  // Comb filters in parallel summed into combMix
  const combMix = ac.createGain()
  combMix.gain.value = 1 / cfg.combDelays.length
  for (const dt of cfg.combDelays) {
    const delay = ac.createDelay(0.2)
    delay.delayTime.value = dt
    const damp = ac.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = cfg.combDamping
    damp.Q.value = 0.7
    const fb = ac.createGain()
    fb.gain.value = cfg.combFeedback
    // x → delay → damp → combMix and delay → damp → fb → delay
    input.connect(delay)
    delay.connect(damp)
    damp.connect(combMix)
    damp.connect(fb)
    fb.connect(delay)
  }

  // 2 series allpass for diffusion
  const ap1 = buildAllpass(ac, cfg.allpassDelays[0], cfg.allpassG)
  const ap2 = buildAllpass(ac, cfg.allpassDelays[1], cfg.allpassG)
  combMix.connect(ap1.input)
  ap1.output.connect(ap2.input)

  // Wet → finalDest (master bus or a loop's duck-gain)
  const wet = ac.createGain()
  wet.gain.value = cfg.wetGain
  ap2.output.connect(wet)
  wet.connect(finalDest)

  return input
}

/**
 * Build a dedicated reverb send routed to the caller's chosen destination.
 * NOT cached — use this when the dry path goes through a custom node
 * (e.g. the map loop's duck-gain) so the wet tail ducks together with it.
 */
export function createReverb(
  ac: AudioContext,
  preset: ReverbPreset,
  finalDest: AudioNode,
): GainNode {
  return buildReverb(ac, PRESETS[preset], finalDest)
}

/**
 * Return a shared reverb send routed to the master bus. Repeated calls with
 * the same (ac, preset) reuse the same instance — use this from one-shot
 * SFX where the dry path also targets the master bus.
 */
export function getReverbSend(ac: AudioContext, preset: ReverbPreset = 'small'): GainNode {
  let entry = cache.get(ac)
  if (!entry) {
    entry = {}
    cache.set(ac, entry)
  }
  if (!entry[preset]) {
    entry[preset] = buildReverb(ac, PRESETS[preset], getMasterBus(ac))
  }
  return entry[preset]!
}
