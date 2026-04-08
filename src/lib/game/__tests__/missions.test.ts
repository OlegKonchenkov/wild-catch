import { describe, expect, it } from 'vitest'
import { missionMatchesTarget, normalizeMissionTargets } from '@/lib/game/missions'

describe('mission target matching', () => {
  it('matches empty mission target against any event', () => {
    expect(missionMatchesTarget('', ['qr-1'])).toBe(true)
  })

  it('matches specific target against any normalized candidate', () => {
    const candidates = normalizeMissionTargets([' QR-ONE ', 'boss01', 'Etichetta Boss'])
    expect(missionMatchesTarget('boss01', candidates)).toBe(true)
    expect(missionMatchesTarget('etichetta boss', candidates)).toBe(true)
  })

  it('does not match specific missions when no event target is provided', () => {
    expect(missionMatchesTarget('fiammare', [])).toBe(false)
  })
})
