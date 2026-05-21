'use client'
import Image from 'next/image'
import { useState } from 'react'
import type { Element } from '@/lib/types'
import { ELEMENT_BACKGROUND, ARENA_BACKGROUND } from '@/lib/game/battle-scene'
import { ELEMENT_THEME, DEFAULT_THEME } from '@/components/game/boss/types'
import SceneParticles from './SceneParticles'

interface Props {
  element: Element | 'arena'
  half: 'top' | 'bottom'
  /** 0..1 extra darkening for low-HP / crit freeze. */
  dim?: number
  /** Pause ambient particles (crit freeze beat). */
  frozen?: boolean
  particleCount?: number
}

/**
 * One half of the battle scene: a painterly per-element background with a slow
 * parallax breath, an element color wash, ambient particles, and a dim overlay
 * for reactivity. If the webp isn't on disk yet (mid asset-rollout) it degrades
 * to a themed CSS gradient so the half is never blank.
 */
export default function ElementBackdrop({ element, half, dim = 0, frozen = false, particleCount = 18 }: Props) {
  const [imgOk, setImgOk] = useState(true)
  const src = element === 'arena' ? ARENA_BACKGROUND : ELEMENT_BACKGROUND[element]
  const theme = element === 'arena' ? DEFAULT_THEME : (ELEMENT_THEME[element] ?? DEFAULT_THEME)
  const glowPos = half === 'top' ? '50% 8%' : '50% 92%'
  const objPos = half === 'top' ? '60% 54%' : '42% 72%'
  const fallback =
    `radial-gradient(120% 85% at ${glowPos}, ${theme.glow}26, transparent 56%),` +
    `linear-gradient(180deg, ${theme.bg}, ${theme.ground})`

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: fallback }}>
      {imgOk && (
        <div
          className="absolute"
          style={{ inset: '-4%', animation: `${half === 'top' ? 'bdDriftA' : 'bdDriftB'} ${half === 'top' ? 22 : 26}s ease-in-out infinite` }}
        >
          <Image
            src={src}
            alt=""
            fill
            priority
            sizes="100vw"
            onError={() => setImgOk(false)}
            style={{ objectFit: 'cover', objectPosition: objPos }}
          />
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 2,
          background: half === 'top'
            ? `radial-gradient(78% 28% at 72% 84%, ${theme.glow}30, rgba(0,0,0,.16) 48%, transparent 72%), linear-gradient(180deg, transparent 54%, rgba(1,4,6,.2) 82%, rgba(1,4,6,.46) 100%)`
            : `radial-gradient(85% 32% at 34% 50%, ${theme.glow}2e, rgba(245,174,88,.16) 42%, transparent 72%), linear-gradient(180deg, rgba(10,6,3,.2) 0%, transparent 28%, rgba(0,0,0,.4) 100%)`,
          mixBlendMode: 'screen',
        }}
      />

      <SceneParticles element={element} count={particleCount} seed={half === 'top' ? 2 : 7} paused={frozen} />

      {/* dim overlay — low HP / crit freeze darkening */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `rgba(2,4,8,${Math.min(0.72, Math.max(0, dim))})`, transition: 'background .35s ease', zIndex: 4 }}
      />

      <style>{`@keyframes bdDriftA{0%,100%{transform:scale(1.06) translateY(0)}50%{transform:scale(1.1) translateY(-6px)}}@keyframes bdDriftB{0%,100%{transform:scale(1.06) translateY(0)}50%{transform:scale(1.1) translateY(5px)}}`}</style>
    </div>
  )
}
