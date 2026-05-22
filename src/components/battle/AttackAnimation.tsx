'use client'
import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import FiammaAttack from './animations/fiamma'
import AdriaticoAttack from './animations/adriatico'
import BoscoAttack from './animations/bosco'
import TerraAttack from './animations/terra'
import ArmoniaAttack from './animations/armonia'
import type { AttackAnimationComponent, AttackAnimationProps } from './animations/types'
import { playDefaultAttack } from '@/lib/game/sounds/attack-defaults'
import { isSfxMuted } from '@/lib/audioPrefs'

const ANIMATION_BY_ELEMENT: Record<string, AttackAnimationComponent> = {
  fiamma: FiammaAttack,
  adriatico: AdriaticoAttack,
  bosco: BoscoAttack,
  terra: TerraAttack,
  armonia: ArmoniaAttack,
}

/**
 * Plug-and-play attack animation component.
 *
 * Renders the correct elemental animation based on `element` + `rarity`,
 * and optionally plays a sound for the duration of the attack.
 *
 * Mount with a unique `key` to re-trigger the animation on each attack:
 *   <AttackAnimation key={attackKey} element="fiamma" rarity="raro" side="left" />
 */
export default function AttackAnimation({
  element,
  rarity,
  side,
  onComplete,
  soundUrl,
  soundDurationMs,
}: AttackAnimationProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Sound playback
  useEffect(() => {
    if (isSfxMuted()) return
    if (!soundUrl) {
      playDefaultAttack(element, rarity)
      return
    }
    const audio = new Audio(soundUrl)
    audio.volume = 0.7
    audioRef.current = audio
    audio.play().catch(() => {/* autoplay blocked — silent fail */})

    const stopAt = soundDurationMs ?? 3000
    const t = setTimeout(() => {
      audio.pause()
      audio.currentTime = 0
    }, stopAt)

    return () => {
      clearTimeout(t)
      audio.pause()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const AnimationComponent = ANIMATION_BY_ELEMENT[element] ?? ArmoniaAttack

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 9 }}
    >
      <AnimatePresence>
        <AnimationComponent
          element={element}
          rarity={rarity}
          side={side}
          onComplete={onComplete}
          soundUrl={soundUrl}
          soundDurationMs={soundDurationMs}
        />
      </AnimatePresence>
    </div>
  )
}
