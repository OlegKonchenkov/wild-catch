import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { getMissionUnlockState, type MissionUnlockFields } from '@/lib/game/mission-unlocks'
import { isTutorialSession } from '@/lib/game/tutorial'

/**
 * GET /api/game/missions/next?sessionId=<uuid>
 *
 * Returns the "current objective" for the persistent map widget — the
 * lowest-`chapter_order`, unlocked, non-completed mission for this player
 * in this session. Falls back to `objective: null` if everything is done
 * or no missions are configured.
 *
 * Shape:
 *   { objective: null | {
 *       id, title, type, target, target_count, progress,
 *       reward_gold, reward_exp, chapter_order
 *     }
 *   }
 */
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })
  }

  // Pull missions, player progress, and player level in parallel. The
  // mission scope depends on the session kind: real events pull both
  // event-scoped and global missions; the tutorial session is isolated
  // so its chain stays a clean scripted story without globals.
  const missionsBase = supabase
    .from('missions')
    .select('id, title, type, target, target_count, reward_gold, reward_exp, unlock_level, unlock_after_mission_id, chapter_order')
  const missionsScoped = isTutorialSession(sessionId)
    ? missionsBase.eq('session_id', sessionId).order('chapter_order', { ascending: true })
    : missionsBase
        .or(`session_id.eq.${sessionId},session_id.is.null`)
        .order('chapter_order', { ascending: true })

  const [missionsRes, pmRes, psRes] = await Promise.all([
    missionsScoped,
    supabase
      .from('player_missions')
      .select('mission_id, progress, completed_at')
      .eq('user_id', user.id)
      .eq('session_id', sessionId),
    supabase
      .from('player_sessions')
      .select('level')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .maybeSingle(),
  ])

  interface MissionRow extends MissionUnlockFields {
    id: string
    title: string
    type: string
    target: string | null
    target_count: number
    reward_gold: number
    reward_exp: number
    chapter_order: number | null
  }
  type PmRow = { mission_id: string; progress: number; completed_at: string | null }

  const missions = (missionsRes.data ?? []) as MissionRow[]
  const pmRows   = (pmRes.data ?? []) as PmRow[]
  const playerLevel = (psRes.data?.level as number | undefined) ?? 1

  const pmByMission = new Map<string, PmRow>(pmRows.map(p => [p.mission_id, p]))
  const completedMissionIds = pmRows.filter(p => p.completed_at).map(p => p.mission_id)
  const missionTitleById = Object.fromEntries(missions.map(m => [m.id, m.title]))

  // Walk missions in chapter_order and return the first unlocked, non-completed one.
  for (const m of missions) {
    const pm = pmByMission.get(m.id)
    if (pm?.completed_at) continue
    const unlockState = getMissionUnlockState(m, {
      playerLevel,
      completedMissionIds,
      missionTitleById,
    })
    if (!unlockState.unlocked) continue

    return NextResponse.json({
      objective: {
        id: m.id,
        title: m.title,
        type: m.type,
        target: m.target,
        target_count: m.target_count,
        progress: pm?.progress ?? 0,
        reward_gold: m.reward_gold,
        reward_exp: m.reward_exp,
        chapter_order: m.chapter_order,
      },
    })
  }

  return NextResponse.json({ objective: null })
}
