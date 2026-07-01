'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'

// Map each ability animation_key to a visual archetype. New keys fall back to
// 'burst'. Archetypes are parametric (driven by the ability's accent colour) so
// every ability reads as a distinct, on-theme special effect without needing a
// bespoke component per move.
type Archetype = 'beam' | 'burst' | 'slashes' | 'motes' | 'ring' | 'spit'

const KEY_ARCHETYPE: Record<string, Archetype> = {
  charge_beam: 'beam',
  fire_nova: 'burst', water_spout: 'burst', quake: 'burst', harmony_beam: 'burst', thunder_zap: 'burst',
  fire_slash: 'slashes', multi_strike: 'slashes', vine_whip: 'slashes', water_wave: 'slashes', leaf_storm: 'slashes',
  regen_bloom: 'motes', harmony_heal: 'motes',
  rock_guard: 'ring', buff_roar: 'ring', debuff_screech: 'ring', shadow_mark: 'ring',
  venom_spit: 'spit', frost_shard: 'spit',
  basic_strike: 'slashes',
}

const DURATION_MS = 1100

export default function AbilityFx({
  animationKey, color, name, side = 'left', onComplete,
}: {
  animationKey: string
  color: string
  name: string
  side?: 'left' | 'right'
  onComplete?: () => void
}) {
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), DURATION_MS)
    return () => clearTimeout(t)
  }, [onComplete])

  const arch = KEY_ARCHETYPE[animationKey] ?? 'burst'
  const originX = side === 'left' ? '30%' : '70%'

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 12 }}>
      {/* Move-name banner */}
      <motion.div
        className="absolute left-1/2 top-[16%] -translate-x-1/2 px-4 py-1.5 rounded-full"
        initial={{ opacity: 0, y: -14, scale: 0.8 }}
        animate={{ opacity: [0, 1, 1, 0], y: [-14, 0, 0, -8], scale: [0.8, 1, 1, 1] }}
        transition={{ duration: DURATION_MS / 1000, times: [0, 0.18, 0.75, 1] }}
        style={{ background: 'rgba(6,13,25,0.72)', border: `1px solid ${color}`, boxShadow: `0 0 18px ${color}77`, backdropFilter: 'blur(4px)' }}
      >
        <span className="text-[13px] font-extrabold tracking-wide" style={{ color, textShadow: `0 0 10px ${color}aa` }}>{name}</span>
      </motion.div>

      {/* Screen flash */}
      <motion.div className="absolute inset-0"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 0.28, 0] }}
        transition={{ duration: 0.5, times: [0, 0.3, 1] }}
        style={{ background: `radial-gradient(circle at 50% 45%, ${color}55, transparent 60%)` }} />

      {arch === 'beam' && <Beam color={color} originX={originX} />}
      {arch === 'burst' && <Burst color={color} />}
      {arch === 'slashes' && <Slashes color={color} side={side} />}
      {arch === 'motes' && <Motes color={color} />}
      {arch === 'ring' && <Ring color={color} />}
      {arch === 'spit' && <Spit color={color} side={side} />}
    </div>
  )
}

function Beam({ color, originX }: { color: string; originX: string }) {
  return (
    <>
      <motion.div className="absolute rounded-full"
        style={{ left: originX, top: '52%', width: 90, height: 90, x: '-50%', y: '-50%', background: `radial-gradient(circle, ${color}, transparent 68%)` }}
        initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: [0.2, 1.3, 0.9], opacity: [0, 1, 0.7] }} transition={{ duration: 0.5 }} />
      <motion.div className="absolute"
        style={{ left: originX, top: '48%', width: '120%', height: 26, transformOrigin: 'left center',
          background: `linear-gradient(90deg, ${color}, ${color}00)`, filter: `drop-shadow(0 0 16px ${color})`, borderRadius: 20 }}
        initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: [0, 1, 1], opacity: [0, 1, 0] }} transition={{ duration: 0.6, delay: 0.4, times: [0, 0.4, 1] }} />
    </>
  )
}

function Burst({ color }: { color: string }) {
  return (
    <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)' }}>
      <motion.div className="absolute rounded-full" style={{ border: `3px solid ${color}`, left: '-50%', top: '-50%' }}
        initial={{ width: 40, height: 40, opacity: 0.9 }} animate={{ width: 340, height: 340, opacity: 0, x: -130, y: -130 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
      {[...Array(9)].map((_, i) => {
        const a = (i / 9) * Math.PI * 2
        return (
          <motion.div key={i} className="absolute rounded-full"
            style={{ width: 12, height: 12, background: color, boxShadow: `0 0 10px ${color}` }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(a) * 150, y: Math.sin(a) * 150, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.8, ease: 'easeOut' }} />
        )
      })}
    </div>
  )
}

function Slashes({ color, side }: { color: string; side: 'left' | 'right' }) {
  const dir = side === 'left' ? 1 : -1
  return (
    <div className="absolute inset-0">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="absolute"
          style={{ left: `${38 + i * 8}%`, top: `${34 + i * 10}%`, width: 180, height: 8, borderRadius: 8,
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`, filter: `drop-shadow(0 0 8px ${color})`,
            transform: `rotate(${dir * (35 - i * 6)}deg)` }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1, 1], opacity: [0, 1, 0] }}
          transition={{ duration: 0.42, delay: i * 0.12, times: [0, 0.4, 1] }} />
      ))}
    </div>
  )
}

function Motes({ color }: { color: string }) {
  return (
    <div className="absolute inset-0">
      {[...Array(12)].map((_, i) => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ left: `${30 + (i * 37) % 40}%`, top: '70%', width: 9, height: 9, background: color, boxShadow: `0 0 8px ${color}` }}
          initial={{ y: 0, opacity: 0, scale: 0.5 }}
          animate={{ y: -150 - (i % 4) * 20, opacity: [0, 1, 0], scale: [0.5, 1, 0.4] }}
          transition={{ duration: 1, delay: (i % 6) * 0.08, ease: 'easeOut' }} />
      ))}
    </div>
  )
}

function Ring({ color }: { color: string }) {
  return (
    <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)' }}>
      {[0, 1].map(i => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ border: `2px solid ${color}`, left: '-50%', top: '-50%' }}
          initial={{ width: 60, height: 60, opacity: 0.8, x: -30, y: -30 }}
          animate={{ width: 240, height: 240, opacity: 0, x: -120, y: -120 }}
          transition={{ duration: 0.8, delay: i * 0.18, ease: 'easeOut' }} />
      ))}
    </div>
  )
}

function Spit({ color, side }: { color: string; side: 'left' | 'right' }) {
  const from = side === 'left' ? '32%' : '68%'
  return (
    <div className="absolute inset-0">
      {[...Array(6)].map((_, i) => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ left: from, top: '50%', width: 12, height: 12, background: color, boxShadow: `0 0 8px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: (side === 'left' ? 1 : -1) * (120 + i * 12), y: (i - 3) * 26, opacity: [1, 1, 0] }}
          transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }} />
      ))}
    </div>
  )
}
