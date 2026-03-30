import { createAdminClient } from '@/lib/supabase/admin'

interface MissionRow {
  id: string
  target: string
  target_count: number
  reward_gold: number
  reward_exp: number
  reward_item_id: string | null
}

/**
 * Increment progress for all matching missions of a given type.
 * @param type     Mission type: 'cattura' | 'duel' | 'qr' | 'collect' | 'walk'
 * @param target   The specific target (creature name, qr label, item name). Empty = match all.
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
  target?: string
  userId: string
  sessionId: string
}) {
  const admin = createAdminClient()

  // Load matching missions for this session and type
  const { data: missions } = await admin
    .from('missions')
    .select('id, target, target_count, reward_gold, reward_exp, reward_item_id')
    .eq('session_id', sessionId)
    .eq('type', type)

  if (!missions?.length) return

  // Match missions: empty mission.target = matches anything; otherwise compare case-insensitively
  const matching = (missions as MissionRow[]).filter(m =>
    !m.target || !target || m.target.toLowerCase() === target.toLowerCase()
  )
  if (!matching.length) return

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
      await grantMissionReward(mission, userId, sessionId, admin)
    }
  }
}

async function grantMissionReward(
  mission: MissionRow,
  userId: string,
  sessionId: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  if (mission.reward_exp > 0) {
    await admin.rpc('increment_player_stats', {
      p_user_id: userId,
      p_session_id: sessionId,
      p_exp: mission.reward_exp,
      p_score: 0,
    })
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

  if (mission.reward_item_id) {
    const { data: existing } = await admin.from('player_inventory')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('item_id', mission.reward_item_id)
      .maybeSingle()
    if (existing) {
      await admin.from('player_inventory')
        .update({ quantity: (existing as any).quantity + 1 })
        .eq('id', (existing as any).id)
    } else {
      await admin.from('player_inventory').insert({
        user_id: userId,
        session_id: sessionId,
        item_id: mission.reward_item_id,
        quantity: 1,
      })
    }
  }
}
