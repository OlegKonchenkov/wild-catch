import { createAdminClient } from '@/lib/supabase/admin'

interface MissionRow {
  id: string
  title: string
  target: string
  target_count: number
  reward_gold: number
  reward_exp: number
  reward_item_id: string | null
  reward_items: Array<{ item_id: string; quantity: number }> | null
}

export interface CompletedMission {
  title: string
  rewardGold: number
  rewardExp: number
  levelUp?: { newLevel: number; goldReward: number } | null
}

/**
 * Increment progress for all matching missions of a given type.
 * @param type     Mission type: 'cattura' | 'duel' | 'qr' | 'collect' | 'walk'
 * @param target   One or more event targets (creature name, qr id/manual code/label, item name).
 * @param userId
 * @param sessionId
 */
export async function incrementMissionProgress({
  type,
  target = '',
  userId,
  sessionId,
}: {
  type: string
  target?: string | string[]
  userId: string
  sessionId: string
}): Promise<CompletedMission[]> {
  const admin = createAdminClient()
  const eventTargets = normalizeMissionTargets(target)

  // Load matching missions for this session and type (include global missions with null session_id)
  const { data: missions } = await admin
    .from('missions')
    .select('id, title, target, target_count, reward_gold, reward_exp, reward_item_id, reward_items')
    .or(`session_id.eq.${sessionId},session_id.is.null`)
    .eq('type', type)

  if (!missions?.length) return []

  // Match missions: empty mission.target = matches anything; otherwise compare case-insensitively
  // against one or more event targets (qr id/manual code/label, etc).
  const matching = (missions as MissionRow[]).filter(m =>
    missionMatchesTarget(m.target, eventTargets)
  )
  if (!matching.length) return []

  // Load existing player_missions entries
  const missionIds = matching.map(m => m.id)
  const { data: playerMissions } = await admin
    .from('player_missions')
    .select('id, mission_id, progress, completed_at')
    .eq('user_id', userId)
    .in('mission_id', missionIds)

  const pmMap: Record<string, any> = Object.fromEntries(
    (playerMissions ?? []).map((pm: any) => [pm.mission_id, pm])
  )

  const completed: CompletedMission[] = []

  for (const mission of matching) {
    const existing = pmMap[mission.id]
    if (existing?.completed_at) continue  // already completed

    const newProgress = (existing?.progress ?? 0) + 1
    const justCompleted = newProgress >= mission.target_count

    if (!existing) {
      await admin.from('player_missions').insert({
        user_id: userId,
        mission_id: mission.id,
        progress: newProgress,
        ...(justCompleted ? { completed_at: new Date().toISOString() } : {}),
      })
    } else {
      await admin.from('player_missions').update({
        progress: newProgress,
        ...(justCompleted ? { completed_at: new Date().toISOString() } : {}),
      }).eq('id', existing.id)
    }

    if (justCompleted) {
      const levelUp = await grantMissionReward(mission, userId, sessionId, admin)
      // Game event for bell history
      admin.from('player_game_events').insert({
        user_id: userId,
        session_id: sessionId,
        type: 'mission_completed',
        payload: { mission_id: mission.id, mission_target: mission.target },
      }).then(undefined, () => {})
      completed.push({
        title: mission.title,
        rewardGold: mission.reward_gold,
        rewardExp: mission.reward_exp,
        levelUp,
      })
    }
  }

  return completed
}

export function normalizeMissionTargets(target?: string | string[]): string[] {
  const rawTargets = Array.isArray(target) ? target : target ? [target] : []
  return [...new Set(
    rawTargets
      .map(value => value.trim().toLowerCase())
      .filter(Boolean),
  )]
}

export function missionMatchesTarget(missionTarget: string | null | undefined, eventTargets: string[]): boolean {
  const normalizedMissionTarget = (missionTarget ?? '').trim().toLowerCase()
  if (!normalizedMissionTarget) return true
  if (eventTargets.length === 0) return false
  return eventTargets.includes(normalizedMissionTarget)
}

async function grantMissionReward(
  mission: MissionRow,
  userId: string,
  sessionId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ newLevel: number; goldReward: number } | null> {
  let levelUp: { newLevel: number; goldReward: number } | null = null

  if (mission.reward_exp > 0) {
    const { data: rpcData } = await admin.rpc('increment_player_stats', {
      p_user_id: userId,
      p_session_id: sessionId,
      p_exp: mission.reward_exp,
      p_score: 0,
    })
    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : null
    if (rpcRow?.leveled_up) {
      levelUp = { newLevel: rpcRow.new_level, goldReward: rpcRow.gold_reward ?? 0 }
    }
  }

  if (mission.reward_gold > 0) {
    const { data: ps } = await admin.from('player_sessions')
      .select('gold')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single()
    if (ps) {
      await admin.from('player_sessions')
        .update({ gold: (ps as any).gold + mission.reward_gold })
        .eq('user_id', userId)
        .eq('session_id', sessionId)
    }
  }

  // Legacy single item reward
  const itemsToGrant: Array<{ item_id: string; quantity: number }> = []
  if (mission.reward_item_id) {
    itemsToGrant.push({ item_id: mission.reward_item_id, quantity: 1 })
  }
  // New multi-item rewards
  if (Array.isArray(mission.reward_items)) {
    for (const ri of mission.reward_items) {
      if (ri.item_id) itemsToGrant.push(ri)
    }
  }

  for (const ri of itemsToGrant) {
    const { data: existing } = await admin.from('player_inventory')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('item_id', ri.item_id)
      .maybeSingle()
    if (existing) {
      await admin.from('player_inventory')
        .update({ quantity: (existing as any).quantity + ri.quantity })
        .eq('id', (existing as any).id)
    } else {
      await admin.from('player_inventory').insert({
        user_id: userId,
        session_id: sessionId,
        item_id: ri.item_id,
        quantity: ri.quantity,
      })
    }
  }

  return levelUp
}
