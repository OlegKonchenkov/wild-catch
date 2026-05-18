/**
 * Branded boot / loading splash.
 *
 * Server-Component-safe (pure markup + a scoped <style> block, no hooks,
 * no framer-motion) so it can back an App-Router `loading.tsx` Suspense
 * boundary as well as client-side "still loading" states. Mirrors the
 * favicon mark — a luminous Daimon orb inside an orbiting ring — so the
 * cold-start identity is consistent from the browser tab to the first
 * full screen the player sees.
 *
 * Animation is CSS-keyframe only and respects prefers-reduced-motion.
 */
export default function DaimonSplash({ label }: { label?: string }) {
  return (
    <div className="dm-splash">
      <style>{`
        .dm-splash {
          position: fixed; inset: 0; z-index: 50;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 30px;
          background:
            radial-gradient(ellipse at 50% 32%, #15324B 0%, transparent 60%),
            linear-gradient(180deg, #0D1E2E 0%, #0A1520 100%);
          color: #fff;
        }
        .dm-orb-wrap {
          position: relative; width: 132px; height: 132px;
          display: flex; align-items: center; justify-content: center;
        }
        /* Soft breathing aura */
        .dm-aura {
          position: absolute; inset: -14px; border-radius: 50%;
          background: radial-gradient(circle, rgba(58,188,168,0.40) 0%, rgba(58,188,168,0.08) 55%, transparent 72%);
          animation: dm-breathe 3.2s ease-in-out infinite;
        }
        /* Orbiting ring + travelling gold node */
        .dm-ring {
          position: absolute; inset: 6px; border-radius: 50%;
          border: 1.5px solid rgba(58,157,188,0.45);
          animation: dm-spin 7s linear infinite;
        }
        .dm-ring::before {
          content: ''; position: absolute; top: -5px; left: 50%;
          width: 9px; height: 9px; margin-left: -4.5px; border-radius: 50%;
          background: #F7C841; box-shadow: 0 0 10px 2px rgba(247,200,65,0.7);
        }
        /* Core orb */
        .dm-core {
          position: relative; width: 76px; height: 76px; border-radius: 50%;
          background: radial-gradient(circle at 40% 36%, #9BF0E2 0%, #3ABCA8 46%, #1C6F76 100%);
          box-shadow: 0 0 26px rgba(58,188,168,0.55), inset 0 2px 6px rgba(255,255,255,0.35);
          animation: dm-bob 3.2s ease-in-out infinite;
        }
        .dm-core::after {
          content: ''; position: absolute; top: 16%; left: 22%;
          width: 30%; height: 22%; border-radius: 50%;
          background: rgba(234,255,251,0.8); filter: blur(1px);
        }
        .dm-word {
          font-family: var(--font-cinzel), Georgia, serif;
          font-size: 30px; font-weight: 700; letter-spacing: 0.22em;
          color: #EAFFFB; text-shadow: 0 0 18px rgba(58,188,168,0.45);
          padding-left: 0.22em;
        }
        .dm-sub {
          margin-top: -18px;
          font-family: var(--font-dm-sans), system-ui, sans-serif;
          font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }
        .dm-dots { display: flex; gap: 7px; margin-top: 4px; }
        .dm-dots i {
          width: 7px; height: 7px; border-radius: 50%; background: #3ABCA8;
          display: inline-block; animation: dm-pulse 1.2s ease-in-out infinite;
        }
        .dm-dots i:nth-child(2) { animation-delay: 0.18s; background: rgba(58,188,168,0.7); }
        .dm-dots i:nth-child(3) { animation-delay: 0.36s; background: rgba(58,188,168,0.42); }

        @keyframes dm-spin   { to   { transform: rotate(360deg); } }
        @keyframes dm-breathe{ 0%,100% { transform: scale(0.94); opacity: 0.75; } 50% { transform: scale(1.08); opacity: 1; } }
        @keyframes dm-bob    { 0%,100% { transform: translateY(0)   scale(1);    } 50% { transform: translateY(-5px) scale(1.03); } }
        @keyframes dm-pulse  { 0%,100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }

        @media (prefers-reduced-motion: reduce) {
          .dm-aura, .dm-ring, .dm-core, .dm-dots i { animation: none; }
        }
      `}</style>

      <div className="dm-orb-wrap">
        <div className="dm-aura" />
        <div className="dm-ring" />
        <div className="dm-core" />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div className="dm-word">DAIMON</div>
        <div className="dm-sub">{label ?? 'Avventura outdoor'}</div>
      </div>

      <div className="dm-dots"><i /><i /><i /></div>
    </div>
  )
}
