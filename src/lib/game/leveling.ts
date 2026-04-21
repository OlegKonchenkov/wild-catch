const BASE_LEVEL_COSTS = [
  30, 50, 70, 95, 125,
  160, 200, 240, 285, 330,
  380, 430, 485, 540, 600,
  660, 725, 790, 860,
] as const

export const MAX_PLAYER_LEVEL = 99
export const FIXED_EXP_PER_LEVEL_FROM_20 = 860

const LEVEL_START_EXP: number[] = [0]

for (let level = 1; level <= MAX_PLAYER_LEVEL; level += 1) {
  LEVEL_START_EXP[level] = LEVEL_START_EXP[level - 1] + getConfiguredExpToNext(level - 1)
}

function clampLevel(level: number): number {
  return Math.min(MAX_PLAYER_LEVEL, Math.max(1, Math.floor(level || 1)))
}

function getConfiguredExpToNext(level: number): number {
  if (level <= 0) return 0
  if (level <= BASE_LEVEL_COSTS.length) return BASE_LEVEL_COSTS[level - 1]
  return FIXED_EXP_PER_LEVEL_FROM_20
}

export function getExpToNextLevel(level: number): number {
  const safeLevel = clampLevel(level)
  if (safeLevel >= MAX_PLAYER_LEVEL) return 0
  return getConfiguredExpToNext(safeLevel)
}

export function getTotalExpForLevel(level: number): number {
  const safeLevel = clampLevel(level)
  return LEVEL_START_EXP[safeLevel]
}

export function getLevelForExp(exp: number): number {
  const safeExp = Math.max(0, Math.floor(exp || 0))

  for (let level = MAX_PLAYER_LEVEL; level >= 1; level -= 1) {
    if (safeExp >= getTotalExpForLevel(level)) return level
  }

  return 1
}

export function getExpProgress(exp: number, level = getLevelForExp(exp)) {
  const safeExp = Math.max(0, Math.floor(exp || 0))
  const safeLevel = clampLevel(level)

  if (safeLevel >= MAX_PLAYER_LEVEL) {
    const cappedAt = getTotalExpForLevel(MAX_PLAYER_LEVEL)
    return {
      level: MAX_PLAYER_LEVEL,
      currentLevelStartExp: cappedAt,
      nextLevelStartExp: cappedAt,
      expIntoLevel: 0,
      expNeededForNextLevel: 0,
      expRemainingToNextLevel: 0,
      percent: 100,
    }
  }

  const currentLevelStartExp = getTotalExpForLevel(safeLevel)
  const expNeededForNextLevel = getExpToNextLevel(safeLevel)
  const expIntoLevel = Math.min(
    expNeededForNextLevel,
    Math.max(0, safeExp - currentLevelStartExp),
  )
  const nextLevelStartExp = currentLevelStartExp + expNeededForNextLevel
  const expRemainingToNextLevel = Math.max(0, expNeededForNextLevel - expIntoLevel)

  return {
    level: safeLevel,
    currentLevelStartExp,
    nextLevelStartExp,
    expIntoLevel,
    expNeededForNextLevel,
    expRemainingToNextLevel,
    percent: Math.min(100, Math.max(0, (expIntoLevel / expNeededForNextLevel) * 100)),
  }
}
