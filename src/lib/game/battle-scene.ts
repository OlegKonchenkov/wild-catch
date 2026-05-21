import type { Element } from '@/lib/types'

// Static per-element battle backgrounds, served by Next from /public (CDN
// cached, versioned with the app). The battle scene composites a transparent
// creature cutout over one of these. NOTE: during the asset rollout only the
// elements that have been generated exist on disk; ElementBackdrop degrades to
// a themed CSS gradient when a file is missing, so a half is never blank.
export const ELEMENT_BACKGROUND: Record<Element, string> = {
  bosco:     '/backgrounds/battle/bosco.webp',
  fiamma:    '/backgrounds/battle/fiamma.webp',
  adriatico: '/backgrounds/battle/adriatico.webp',
  terra:     '/backgrounds/battle/terra.webp',
  armonia:   '/backgrounds/battle/armonia.webp',
}

/** Neutral arena used by duels (PvP mixes two elements → neutral reads fairer). */
export const ARENA_BACKGROUND = '/backgrounds/battle/arena.webp'

/**
 * Cutout-first sprite resolver: prefer the transparent cutout, fall back to the
 * baked art (image_url), else empty. Keeps the app working mid-rollout when
 * only some creatures have a regenerated cutout.
 */
export function resolveCreatureSprite(c: {
  sprite_cutout_url?: string | null
  sprite_url?: string | null
  image_url?: string | null
}): string {
  return c.sprite_cutout_url || c.sprite_url || c.image_url || ''
}
