import { describe, expect, it } from 'vitest'
import { missionMatchesTarget, normalizeMissionTargets } from '@/lib/game/missions'
import { getMissionUnlockState } from '@/lib/game/mission-unlocks'

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

describe('mission unlock state', () => {
  it('keeps missions without requirements unlocked', () => {
    const state = getMissionUnlockState(
      { id: 'mission-1' },
      { playerLevel: 1, completedMissionIds: [] },
    )

    expect(state.unlocked).toBe(true)
    expect(state.reasons).toEqual([])
  })

  it('locks and unlocks by required level', () => {
    expect(getMissionUnlockState(
      { id: 'mission-1', unlock_level: 5 },
      { playerLevel: 4, completedMissionIds: [] },
    )).toMatchObject({
      unlocked: false,
      levelLocked: true,
      reasons: ['Raggiungi il livello 5'],
    })

    expect(getMissionUnlockState(
      { id: 'mission-1', unlock_level: 5 },
      { playerLevel: 5, completedMissionIds: [] },
    ).unlocked).toBe(true)
  })

  it('locks and unlocks by prerequisite mission completion', () => {
    expect(getMissionUnlockState(
      { id: 'mission-2', unlock_after_mission_id: 'mission-1' },
      {
        playerLevel: 1,
        completedMissionIds: [],
        missionTitleById: { 'mission-1': 'Primo passo' },
      },
    )).toMatchObject({
      unlocked: false,
      missionLocked: true,
      reasons: ['Completa "Primo passo"'],
    })

    expect(getMissionUnlockState(
      { id: 'mission-2', unlock_after_mission_id: 'mission-1' },
      { playerLevel: 1, completedMissionIds: ['mission-1'] },
    ).unlocked).toBe(true)
  })

  it('uses OR when level and prerequisite are both configured', () => {
    expect(getMissionUnlockState(
      { id: 'mission-2', unlock_level: 10, unlock_after_mission_id: 'mission-1' },
      { playerLevel: 10, completedMissionIds: [] },
    ).unlocked).toBe(true)

    expect(getMissionUnlockState(
      { id: 'mission-2', unlock_level: 10, unlock_after_mission_id: 'mission-1' },
      { playerLevel: 1, completedMissionIds: ['mission-1'] },
    ).unlocked).toBe(true)

    expect(getMissionUnlockState(
      { id: 'mission-2', unlock_level: 10, unlock_after_mission_id: 'mission-1' },
      { playerLevel: 1, completedMissionIds: [] },
    ).unlocked).toBe(false)
  })
})
