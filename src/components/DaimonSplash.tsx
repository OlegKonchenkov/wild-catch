/**
 * Branded boot / loading splash.
 *
 * Server-Component-safe (pure markup + a scoped <style> block, no hooks,
 * no framer-motion) so it can back an App-Router `loading.tsx` Suspense
 * boundary as well as client-side "still loading" states.
 *
 * Shows the EXACT launcher/PWA creature art (`/icons/icon-512.png`) so
 * the identity is seamless: native install icon → cold-start splash →
 * first screen all show the same Daimon guardian. The square navy tile
 * edge is feathered away with a radial mask + a soft aura so the art
 * dissolves into the splash gradient instead of reading as a pasted
 * box. An orbiting gold node (location/discovery cue) circles it.
 *
 * CSS-keyframe animation only; respects prefers-reduced-motion.
 */
export default function DaimonSplash({ label }: { label?: string }) {
  return (
    <div className="dm-splash">
      <style>{`
        .dm-splash {
          position: fixed; inset: 0; z-index: 50;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 28px;
          background:
            radial-gradient(ellipse at 50% 34%, #15324B 0%, transparent 60%),
            linear-gradient(180deg, #0D1E2E 0%, #0A1520 100%);
          color: #fff;
        }
        .dm-hero-wrap {
          position: relative; width: 208px; height: 208px;
          display: flex; align-items: center; justify-content: center;
        }
        /* Soft breathing aura behind the creature */
        .dm-aura {
          position: absolute; inset: 8px; border-radius: 50%;
          background: radial-gradient(circle, rgba(58,188,168,0.34) 0%, rgba(58,188,168,0.07) 56%, transparent 72%);
          animation: dm-breathe 3.4s ease-in-out infinite;
        }
        /* Orbiting ring + travelling gold node — discovery/compass cue */
        .dm-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1.5px solid rgba(58,157,188,0.32);
          animation: dm-spin 8s linear infinite;
        }
        .dm-ring::before {
          content: ''; position: absolute; top: -4px; left: 50%;
          width: 8px; height: 8px; margin-left: -4px; border-radius: 50%;
          background: #F7C841; box-shadow: 0 0 10px 2px rgba(247,200,65,0.65);
        }
        /* The real launcher art, edge feathered into the bg */
        .dm-hero {
          position: relative; width: 168px; height: 168px;
          object-fit: contain;
          -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 60%, transparent 78%);
                  mask-image: radial-gradient(circle at 50% 50%, #000 60%, transparent 78%);
          filter: drop-shadow(0 6px 22px rgba(0,0,0,0.5));
          animation: dm-bob 3.4s ease-in-out infinite;
        }
        .dm-word {
          font-family: var(--font-cinzel), Georgia, serif;
          font-size: 30px; font-weight: 700; letter-spacing: 0.22em;
          color: #EAFFFB; text-shadow: 0 0 18px rgba(58,188,168,0.45);
          padding-left: 0.22em;
        }
        .dm-sub {
          margin-top: -16px;
          font-family: var(--font-dm-sans), system-ui, sans-serif;
          font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }
        .dm-dots { display: flex; gap: 7px; margin-top: 2px; }
        .dm-dots i {
          width: 7px; height: 7px; border-radius: 50%; background: #3ABCA8;
          display: inline-block; animation: dm-pulse 1.2s ease-in-out infinite;
        }
        .dm-dots i:nth-child(2) { animation-delay: 0.18s; background: rgba(58,188,168,0.7); }
        .dm-dots i:nth-child(3) { animation-delay: 0.36s; background: rgba(58,188,168,0.42); }

        @keyframes dm-spin   { to   { transform: rotate(360deg); } }
        @keyframes dm-breathe{ 0%,100% { transform: scale(0.95); opacity: 0.7; } 50% { transform: scale(1.08); opacity: 1; } }
        @keyframes dm-bob    { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes dm-pulse  { 0%,100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }

        @media (prefers-reduced-motion: reduce) {
          .dm-aura, .dm-ring, .dm-hero, .dm-dots i { animation: none; }
        }
      `}</style>

      <div className="dm-hero-wrap">
        <div className="dm-aura" />
        <div className="dm-ring" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dm-hero" src="/icons/icon-512.png" alt="Daimon" />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div className="dm-word">DAIMON</div>
        <div className="dm-sub">{label ?? 'Avventura outdoor'}</div>
      </div>

      <div className="dm-dots"><i /><i /><i /></div>
    </div>
  )
}
