export interface MissionUnlockFields {
  id: string
  title?: string | null
  unlock_level?: number | null
  unlock_after_mission_id?: string | null
}

export interface MissionUnlockContext {
  playerLevel: number
  completedMissionIds: Iterable<string>
  missionTitleById?: Record<string, string | null | undefined>
}

export interface MissionUnlockState {
  unlocked: boolean
  levelLocked: boolean
  missionLocked: boolean
  reasons: string[]
  requiredLevel: number | null
  prerequisiteMissionId: string | null
  prerequisiteTitle: string | null
}

export function getMissionUnlockState(
  mission: MissionUnlockFields,
  context: MissionUnlockContext,
): MissionUnlockState {
  const requiredLevel = typeof mission.unlock_level === 'number' && mission.unlock_level >= 1
    ? mission.unlock_level
    : null
  const prerequisiteMissionId = mission.unlock_after_mission_id || null
  const completed = new Set(context.completedMissionIds)

  const hasLevelRequirement = requiredLevel !== null
  const hasMissionRequirement = !!prerequisiteMissionId
  const levelSatisfied = !hasLevelRequirement || context.playerLevel >= requiredLevel
  const missionSatisfied = !hasMissionRequirement || completed.has(prerequisiteMissionId!)

  // If both requirements are set, either one unlocks the mission.
  const unlocked = hasLevelRequirement && hasMissionRequirement
    ? levelSatisfied || missionSatisfied
    : levelSatisfied && missionSatisfied

  const prerequisiteTitle = prerequisiteMissionId
    ? context.missionTitleById?.[prerequisiteMissionId] ?? null
    : null

  const reasons: string[] = []
  if (!unlocked && hasLevelRequirement && !levelSatisfied) {
    reasons.push(`Raggiungi il livello ${requiredLevel}`)
  }
  if (!unlocked && hasMissionRequirement && !missionSatisfied) {
    reasons.push(prerequisiteTitle ? `Completa "${prerequisiteTitle}"` : 'Completa la missione richiesta')
  }

  return {
    unlocked,
    levelLocked: hasLevelRequirement && !levelSatisfied,
    missionLocked: hasMissionRequirement && !missionSatisfied,
    reasons,
    requiredLevel,
    prerequisiteMissionId,
    prerequisiteTitle,
  }
}

