'use client'
import { type CSSProperties } from 'react'
import Image from 'next/image'
import CreatureSprite from './CreatureSprite'
import { resolveCreatureSprite, ELEMENT_BACKGROUND } from '@/lib/game/battle-scene'

type AnimState = 'idle' | 'attack' | 'damage' | 'catch' | 'flee' | 'victory'

interface CreatureLike {
  element: string
  name?: string
  rarity?: string
  sprite_cutout_url?: string | null
  sprite_url?: string | null
  image_url?: string | null
}

interface Props {
  creature: CreatureLike
  /** Sprite size (px). */
  size?: number
  /** Frame aspect ratio when width/height aren't fixed by the parent. */
  aspect?: string
  rounded?: number
  /** Ground the creature at the bottom (battle-like) or center it. */
  anchor?: 'center' | 'bottom'
  showAura?: boolean
  animState?: AnimState
  /** 0..1 extra darken over the background. */
  dim?: number
  /** Force the scene photo on/off. By default the photo is used only when the
   *  tile is large enough (a detailed scene turns muddy below ~56px → crisp
   *  element gradient instead). */
  scene?: boolean
  /** next/image sizes hint for the background. */
  sizes?: string
  className?: string
  style?: CSSProperties
}

// Themed CSS fallback so a creature without a generated cutout still sits in a
// tasteful element-tinted frame instead of a bare box (no double-baked-bg).
const ELEMENT_FALLBACK: Record<string, string> = {
  bosco:     'linear-gradient(180deg,#0f2417,#06100b)',
  fiamma:    'linear-gradient(180deg,#221008,#160d09)',
  adriatico: 'linear-gradient(180deg,#04223a,#02101e)',
  terra:     'linear-gradient(180deg,#221805,#120d02)',
  armonia:   'linear-gradient(180deg,#180a2a,#0c0518)',
}
const ELEMENT_TINT: Record<string, string> = {
  bosco: '#2ECC6A', fiamma: '#FF5520', adriatico: '#00C4E8', terra: '#D4A060', armonia: '#B060F8',
}

/**
 * A creature composited inside its element environment: per-element background
 * + the transparent cutout (CreatureSprite, aura on). The premium "diorama"
 * look from the DaimonDex, reusable anywhere a single creature is showcased
 * (encounter popup, catch / egg / pin reveals, duel & starter selection…).
 *
 * Falls back to a themed gradient + the resolved sprite when no cutout exists,
 * so legacy creatures and mid-rollout states still render cleanly.
 */
export default function CreatureDiorama({
  creature, size = 150, aspect = '1 / 1', rounded = 20, anchor = 'bottom',
  showAura = true, animState = 'idle', dim = 0, scene = true, sizes = '(max-width:520px) 96vw, 480px', className, style,
}: Props) {
  const sprite = resolveCreatureSprite(creature)
  const hasCutout = !!creature.sprite_cutout_url
  const bg = ELEMENT_BACKGROUND[creature.element as keyof typeof ELEMENT_BACKGROUND]
  // A detailed scene photo turns muddy at small sizes — only use it when the
  // tile is large enough; otherwise a crisp element-tinted gradient.
  const useScene = scene && hasCutout && !!bg && size >= 56
  const tint = ELEMENT_TINT[creature.element] ?? '#3A9DBC'

  return (
    <div
      className={className}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: rounded, aspectRatio: aspect, background: ELEMENT_FALLBACK[creature.element] ?? '#0a0f16', ...style }}
    >
      {useScene ? (
        <>
          <Image src={bg!} alt="" fill sizes={sizes} quality={85} className="object-cover" />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 92% at 50% 28%, transparent 40%, rgba(4,6,10,0.52) 100%)' }} />
          {dim > 0 && <div className="absolute inset-0 pointer-events-none" style={{ background: `rgba(3,5,9,${Math.min(0.7, dim)})` }} />}
        </>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 38%, ${tint}33, transparent 72%)` }} />
      )}
      <div className={`absolute inset-0 flex justify-center ${anchor === 'bottom' ? 'items-end pb-1' : 'items-center'}`}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <CreatureSprite imageUrl={sprite} name={creature.name ?? ''} size={size} element={creature.element as any} rarity={creature.rarity as any} animState={animState} showAura={showAura} />
      </div>
    </div>
  )
}
