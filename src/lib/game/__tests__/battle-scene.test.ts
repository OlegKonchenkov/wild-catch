import { describe, it, expect } from 'vitest'
import { resolveCreatureSprite, ELEMENT_BACKGROUND, ARENA_BACKGROUND } from '../battle-scene'

describe('resolveCreatureSprite', () => {
  it('prefers cutout', () => {
    expect(resolveCreatureSprite({ sprite_cutout_url: 'a.png', image_url: 'b.png' })).toBe('a.png')
  })
  it('falls back to baked art', () => {
    expect(resolveCreatureSprite({ sprite_cutout_url: null, image_url: 'b.png' })).toBe('b.png')
  })
  it('supports legacy sprite_url as the battle cutout field', () => {
    expect(resolveCreatureSprite({ sprite_url: 'sprite.png', image_url: 'b.png' })).toBe('sprite.png')
  })
  it('empty when neither', () => {
    expect(resolveCreatureSprite({})).toBe('')
  })
})

describe('ELEMENT_BACKGROUND', () => {
  it('covers all 5 elements', () => {
    expect(Object.keys(ELEMENT_BACKGROUND)).toHaveLength(5)
  })
  it('points at webp under /backgrounds/battle', () => {
    for (const url of Object.values(ELEMENT_BACKGROUND)) {
      expect(url).toMatch(/^\/backgrounds\/battle\/.+\.webp$/)
    }
    expect(ARENA_BACKGROUND).toMatch(/^\/backgrounds\/battle\/.+\.webp$/)
  })
})
