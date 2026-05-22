'use client'
import { motion } from 'framer-motion'

export type EvoPhase = 'idle' | 'charge' | 'flash'

const ELEMENT_GLOW: Record<string, string> = {
  fiamma: '#FF6B35', adriatico: '#00C4E8', bosco: '#34D399', terra: '#F2A247', armonia: '#B060F8',
}

/**
 * Full-screen evolution VFX: spinning energy rings + core flare + outward sparks
 * (charge), then a white blast (flash). The screen orchestrates the phase
 * timeline and reveals the evolved creature once flash completes. Element-tinted;
 * self-contained keyframes so it works anywhere (encounter, bestiary, boss).
 */
export default function EvolutionFx({ phase, element = 'armonia' }: { phase: EvoPhase; element?: string }) {
  if (phase === 'idle') return null
  const glow = ELEMENT_GLOW[element] ?? '#F7C841'

  return (
    <div
      className="fixed inset-0 z-[1200] flex flex-col items-center justify-center select-none"
      style={{ background: 'rgba(2,4,8,0.92)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
    >
      {phase === 'charge' && (
        <div className="flex flex-col items-center gap-7">
          <div className="relative flex items-center justify-center" style={{ width: 210, height: 210 }}>
            <div style={{ position: 'absolute', width: 210, height: 210, borderRadius: '50%', border: `3px solid ${glow}`, boxShadow: `0 0 30px ${glow}88, inset 0 0 30px ${glow}22`, animation: 'evoFxSpin 1.2s linear infinite' }} />
            <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', border: `2px solid ${glow}99`, boxShadow: `0 0 20px ${glow}66`, animation: 'evoFxSpin 0.8s linear infinite reverse' }} />
            <div style={{ position: 'absolute', width: 92, height: 92, borderRadius: '50%', border: `2px dashed ${glow}cc`, animation: 'evoFxSpin 0.5s linear infinite' }} />
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: `radial-gradient(circle, #fff 0%, ${glow} 60%, transparent 100%)`, boxShadow: `0 0 46px ${glow}, 0 0 92px ${glow}66`, animation: 'evoFxPulse 0.6s ease-in-out infinite alternate' }} />
            {Array.from({ length: 10 }).map((_, i) => {
              const a = (i / 10) * Math.PI * 2
              return (
                <motion.span
                  key={i}
                  className="absolute"
                  style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', boxShadow: `0 0 9px ${glow}, 0 0 4px #fff` }}
                  animate={{ x: [0, Math.cos(a) * 132], y: [0, Math.sin(a) * 132], opacity: [1, 0], scale: [1.1, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.05, ease: 'easeOut' }}
                />
              )
            })}
          </div>
          <p className="text-white/75 text-sm font-extrabold tracking-[0.25em] uppercase" style={{ animation: 'evoFxPulse 0.6s ease-in-out infinite alternate' }}>
            Evoluzione in corso…
          </p>
        </div>
      )}

      {phase === 'flash' && <div className="absolute inset-0" style={{ background: '#fff', animation: 'evoFxFlash 0.5s ease-out forwards' }} />}

      <style>{`
        @keyframes evoFxSpin{to{transform:rotate(360deg)}}
        @keyframes evoFxPulse{from{opacity:.6;transform:scale(.92)}to{opacity:1;transform:scale(1.1)}}
        @keyframes evoFxFlash{0%{opacity:0}28%{opacity:1}100%{opacity:0}}
      `}</style>
    </div>
  )
}
