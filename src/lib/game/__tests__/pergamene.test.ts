import { describe, it, expect } from 'vitest'
import { pergameneEarned, PERGAMENA_STEP_INTERVAL, PERGAMENE_MAX_PER_UPDATE } from '../pergamene'

describe('pergameneEarned', () => {
  it('no crossing → 0', () => {
    expect(pergameneEarned(0, 249)).toBe(0)
    expect(pergameneEarned(250, 300)).toBe(0)
    expect(pergameneEarned(100, 100)).toBe(0)
  })
  it('one crossing → 1', () => {
    expect(pergameneEarned(249, 250)).toBe(1)
    expect(pergameneEarned(0, PERGAMENA_STEP_INTERVAL)).toBe(1)
    expect(pergameneEarned(490, 510)).toBe(1)
  })
  it('multiple crossings, capped', () => {
    expect(pergameneEarned(0, 500)).toBe(2)
    expect(pergameneEarned(0, 250 * 10)).toBe(PERGAMENE_MAX_PER_UPDATE)
  })
  it('backwards or negative input is safe', () => {
    expect(pergameneEarned(500, 200)).toBe(0)
    expect(pergameneEarned(-10, 10)).toBe(0)
  })
})
