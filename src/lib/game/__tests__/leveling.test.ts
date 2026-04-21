import { describe, expect, it } from 'vitest'

import {
  FIXED_EXP_PER_LEVEL_FROM_20,
  getExpProgress,
  getExpToNextLevel,
  getLevelForExp,
  getTotalExpForLevel,
  MAX_PLAYER_LEVEL,
} from '@/lib/game/leveling'

describe('leveling', () => {
  it('keeps the configured threshold for the level 19 to 20 transition', () => {
    expect(getExpToNextLevel(19)).toBe(860)
    expect(getTotalExpForLevel(20)).toBe(7055)
    expect(getLevelForExp(7054)).toBe(19)
    expect(getLevelForExp(7055)).toBe(20)
  })

  it('uses a fixed 860 exp cost from level 20 onward', () => {
    expect(getExpToNextLevel(20)).toBe(FIXED_EXP_PER_LEVEL_FROM_20)
    expect(getTotalExpForLevel(21)).toBe(7915)
    expect(getLevelForExp(7914)).toBe(20)
    expect(getLevelForExp(7915)).toBe(21)
  })

  it('caps the player level at 99', () => {
    expect(getLevelForExp(getTotalExpForLevel(MAX_PLAYER_LEVEL))).toBe(MAX_PLAYER_LEVEL)
    expect(getLevelForExp(getTotalExpForLevel(MAX_PLAYER_LEVEL) + 500000)).toBe(MAX_PLAYER_LEVEL)
    expect(getExpToNextLevel(MAX_PLAYER_LEVEL)).toBe(0)
  })

  it('reports progress inside the current level and stays full at max level', () => {
    const level20Start = getTotalExpForLevel(20)
    expect(getExpProgress(level20Start + 430, 20)).toMatchObject({
      level: 20,
      expIntoLevel: 430,
      expNeededForNextLevel: 860,
      expRemainingToNextLevel: 430,
      percent: 50,
    })

    expect(getExpProgress(getTotalExpForLevel(MAX_PLAYER_LEVEL) + 9999, MAX_PLAYER_LEVEL)).toMatchObject({
      level: MAX_PLAYER_LEVEL,
      expNeededForNextLevel: 0,
      expRemainingToNextLevel: 0,
      percent: 100,
    })
  })
})
