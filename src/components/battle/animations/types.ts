import type React from 'react'

export interface AttackAnimationProps {
  element: string
  rarity: string
  /** 'left' = player attacks (bottom-left → top-right)
   *  'right' = opponent attacks (top-right → bottom-left) */
  side: 'left' | 'right'
  onComplete?: () => void
  soundUrl?: string | null
  soundDurationMs?: number | null
}

export type AttackAnimationComponent = React.FC<AttackAnimationProps>

/** Absolute-% coordinates of origin and impact within the battle field container */
export const ATTACK_COORDS = {
  left:  { ox: '14%', oy: '70%', ix: '74%', iy: '16%' },
  right: { ox: '74%', oy: '16%', ix: '14%', iy: '70%' },
} as const

/** Travel + total duration (ms) per rarity */
export const RARITY_TIMING: Record<string, { travel: number; total: number }> = {
  comune:      { travel: 280, total: 480  },
  non_comune:  { travel: 320, total: 580  },
  raro:        { travel: 360, total: 680  },
  epico:       { travel: 440, total: 880  },
  leggendario: { travel: 520, total: 1080 },
  mitologico:  { travel: 640, total: 1380 },
}

/** Projectile base diameter (px) per rarity */
export const RARITY_SIZE: Record<string, number> = {
  comune:      18,
  non_comune:  22,
  raro:        27,
  epico:       34,
  leggendario: 42,
  mitologico:  54,
}
