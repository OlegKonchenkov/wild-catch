'use client'

/**
 * Shared per-element battle ambience layer.
 *
 * Sits ON TOP of each battle screen's existing static theme gradient
 * (encounter / duel / boss) and adds life without competing with the
 * sprites: two slow-drifting energy currents, a sparse rise of ambient
 * motes, and a very faint horizontal light sweep — all tinted by the
 * two combatants' element glow colours.
 *
 * Design constraints (deliberate, low-regression):
 *  - `pointer-events:none`, purely decorative, additive — does not
 *    replace the working thematic backgrounds.
 *  - Opacities are intentionally low and the vertical centre band
 *    (~36–60%, where the creature sprites + HP bars live) is kept
 *    clearest: currents bias to the top/bottom, motes hug the edges.
 *  - GPU-cheap (transforms/opacity only), CSS-keyframe, honours
 *    prefers-reduced-motion.
 *  - Self-contained scoped <style>; no external assets, no deps.
 *
 * Place it immediately AFTER the existing theme-gradient block and
 * BEFORE the z-10 battle field so it layers over the gradient but
 * under the creatures/UI.
 */
interface Props {
  /** Primary element glow hex (e.g. wild / opponent element). */
  a: string
  /** Secondary element glow hex (e.g. player element). */
  b: string
}

// Deterministic mote layout (no Math.random → stable SSR/CSR, no
// hydration mismatch). Edges only, never the centre sprite band.
const MOTES = Array.from({ length: 12 }, (_, i) => {
  const left = (i * 31 + 7) % 100
  // Push every mote away from the 38–60% centre band.
  const startTop = i % 2 === 0 ? 62 + ((i * 17) % 32) : 4 + ((i * 13) % 26)
  return {
    left,
    startTop,
    size: 3 + (i % 3),
    dur: 9 + (i % 5) * 2,
    delay: (i * 0.8) % 6,
    useA: i % 2 === 0,
  }
})

export default function BattleAtmosphere({ a, b }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <style>{`
        @keyframes ba-driftA { 0%,100% { transform: translate(-6%, -4%) scale(1); } 50% { transform: translate(8%, 5%) scale(1.15); } }
        @keyframes ba-driftB { 0%,100% { transform: translate(6%, 4%) scale(1.1); } 50% { transform: translate(-7%, -5%) scale(0.95); } }
        @keyframes ba-sweep  { 0% { transform: translateX(-60%); opacity: 0; } 50% { opacity: 0.5; } 100% { transform: translateX(60%); opacity: 0; } }
        @keyframes ba-mote   { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 15% { opacity: 0.7; } 85% { opacity: 0.5; } 100% { transform: translateY(-46px) scale(1); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .ba-driftA,.ba-driftB,.ba-sweep,.ba-mote { animation: none !important; }
          .ba-sweep { display: none; }
        }
      `}</style>

      {/* Energy current — primary, biased to the top */}
      <div
        className="ba-driftA absolute"
        style={{
          top: '-18%', left: '-12%', width: '70%', height: '62%', borderRadius: '50%',
          background: `radial-gradient(circle, ${a}26 0%, ${a}0d 45%, transparent 70%)`,
          filter: 'blur(34px)',
          animation: 'ba-driftA 13s ease-in-out infinite',
        }}
      />
      {/* Energy current — secondary, biased to the bottom */}
      <div
        className="ba-driftB absolute"
        style={{
          bottom: '-20%', right: '-14%', width: '72%', height: '64%', borderRadius: '50%',
          background: `radial-gradient(circle, ${b}22 0%, ${b}0b 45%, transparent 70%)`,
          filter: 'blur(36px)',
          animation: 'ba-driftB 16s ease-in-out infinite',
        }}
      />
      {/* Faint horizontal light sweep across the mid-field */}
      <div
        className="ba-sweep absolute"
        style={{
          top: '30%', left: 0, width: '55%', height: '40%',
          background: `linear-gradient(100deg, transparent 0%, ${a}14 45%, ${b}10 55%, transparent 100%)`,
          filter: 'blur(8px)',
          animation: 'ba-sweep 11s ease-in-out infinite',
        }}
      />
      {/* Ambient motes — edges only */}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="ba-mote absolute rounded-full"
          style={{
            left: `${m.left}%`,
            top: `${m.startTop}%`,
            width: m.size,
            height: m.size,
            background: m.useA ? a : b,
            boxShadow: `0 0 ${m.size * 2}px ${m.useA ? a : b}`,
            opacity: 0.4,
            animation: `ba-mote ${m.dur}s linear ${m.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
