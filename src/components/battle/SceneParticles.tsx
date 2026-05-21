'use client'
import { useMemo } from 'react'
import type { Element } from '@/lib/types'

// Per-element ambient particle styling. Drives the "alive" feel of each scene
// half: spores drift up through the forest, embers rise off the lava, etc.
const ELEMENT_PARTICLE: Record<Element | 'arena', { color: string; glow: string }> = {
  bosco:     { color: 'rgba(200,245,180,.85)', glow: 'rgba(190,240,170,.7)' },
  fiamma:    { color: 'rgba(255,170,70,.92)',  glow: 'rgba(255,130,40,.85)' },
  adriatico: { color: 'rgba(160,228,255,.75)', glow: 'rgba(120,210,255,.6)' },
  terra:     { color: 'rgba(255,202,120,.85)', glow: 'rgba(255,170,80,.7)' },
  armonia:   { color: 'rgba(214,164,255,.9)',  glow: 'rgba(190,120,255,.7)' },
  arena:     { color: 'rgba(220,228,235,.55)', glow: 'rgba(200,212,225,.4)' },
}

// Deterministic PRNG so the server prerender and client hydration agree
// (Math.random would mismatch and warn). Seeded per half.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Props {
  element: Element | 'arena'
  count?: number
  seed?: number
  /** Freeze drift during a crit beat. */
  paused?: boolean
}

export default function SceneParticles({ element, count = 18, seed = 1, paused = false }: Props) {
  const meta = ELEMENT_PARTICLE[element]
  const parts = useMemo(() => {
    const rnd = mulberry32(seed * 9973 + count)
    return Array.from({ length: count }, () => ({
      left: rnd() * 100,
      bottom: rnd() * 46,
      size: 2 + rnd() * 3.5,
      dur: 4 + rnd() * 4.5,
      delay: rnd() * 6,
      drift: (rnd() * 2 - 1) * 22,
    }))
  }, [count, seed])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 3 }}>
      {parts.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: meta.color,
            boxShadow: `0 0 ${Math.round(p.size * 2.4)}px ${meta.glow}`,
            opacity: 0,
            ['--drift' as string]: `${p.drift}px`,
            animation: `battleRise ${p.dur}s linear ${p.delay}s infinite`,
            animationPlayState: paused ? 'paused' : 'running',
            willChange: 'transform, opacity',
          }}
        />
      ))}
      <style>{`@keyframes battleRise{0%{transform:translateY(20px) translateX(0);opacity:0}15%{opacity:.9}100%{transform:translateY(-210px) translateX(var(--drift,12px));opacity:0}}`}</style>
    </div>
  )
}
