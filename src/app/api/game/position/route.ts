import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isWithinBounds, haversineDistance } from '@/lib/game/anti-cheat'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { lat, lng, accuracy, sessionId } = body

  if (typeof lat !== 'number' || typeof lng !== 'number' || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Get player session and session details in parallel
  const [{ data: playerSession }, { data: session }] = await Promise.all([
    supabase
      .from('player_sessions')
      .select('id, last_position, steps_walked')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .single(),
    supabase
      .from('sessions')
      .select('status, area_bounds, end_at')
      .eq('id', sessionId)
      .single(),
  ])

  if (!playerSession) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  if (!session)       return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // Check session expiry on every GPS poll
  if (session.status === 'ended') {
    return NextResponse.json({ sessionEnded: true })
  }
  if (session.status === 'active' && session.end_at && new Date() >= new Date(session.end_at)) {
    await supabase.from('sessions').update({ status: 'ended' }).eq('id', sessionId)
    return NextResponse.json({ sessionEnded: true })
  }

  const currentPos = { lat, lng }

  // PostGIS POINT serializes as { x: lng, y: lat }
  const rawPos = playerSession.last_position as { x: number; y: number } | null
  const prevPos = rawPos ? { lat: rawPos.y, lng: rawPos.x } : null

  // Check within bounds — expand by GPS accuracy so jitter near the border
  // doesn't falsely flag the player as out-of-bounds.
  const accuracyDeg = Math.max((accuracy ?? 50) / 111000, 0.0002) // min ~22 m
  const bounds = session.area_bounds as { north: number; south: number; east: number; west: number } | null
  const inBounds = bounds && typeof bounds.north === 'number'
    ? isWithinBounds(currentPos, {
        north: bounds.north + accuracyDeg,
        south: bounds.south - accuracyDeg,
        east:  bounds.east  + accuracyDeg,
        west:  bounds.west  - accuracyDeg,
      })
    : true

  const distanceMoved = prevPos ? haversineDistance(prevPos, currentPos) : 0
  // Relaxed to 200m — mobile GPS in open air often reports 80-200m accuracy
  const goodAccuracy = (accuracy ?? 200) < 200

  // Step accumulation: only when in bounds, good accuracy, moved between 0.5m and 500m
  // (500m cap prevents teleport from appearing as steps)
  const validStep = inBounds && goodAccuracy && distanceMoved >= 0.5 && distanceMoved < 500
  const stepsIncrement = validStep ? Math.round(distanceMoved) : 0
  const newStepsWalked = (playerSession.steps_walked ?? 0) + stepsIncrement

  // Persist GPS position (and optionally steps)
  await supabase
    .from('player_sessions')
    .update({
      last_position: `(${lng},${lat})`,
      ...(stepsIncrement > 0 ? { steps_walked: newStepsWalked } : {}),
    })
    .eq('id', playerSession.id)

  // Walk mission progress: update whenever steps change
  if (stepsIncrement > 0 && session.status === 'active') {
    await updateWalkMissions(sessionId, user.id, newStepsWalked, supabase)
  }

  // Encounter trigger: only when in bounds, session active, moved ≥5m, good accuracy
  let triggerEncounter = false
  if (inBounds && session.status === 'active') {
    if (goodAccuracy && distanceMoved >= 5) {
      triggerEncounter = Math.random() < 0.30  // 30% per ≥5 m step
    }
  }

  return NextResponse.json({ valid: true, inBounds, triggerEncounter, sessionStatus: session.status, stepsWalked: newStepsWalked, distanceMoved })
}

async function updateWalkMissions(
  sessionId: string,
  userId: string,
  stepsWalked: number,
  supabase: any,
) {
  // Load walk missions for this session
  const { data: walkMissions } = await supabase
    .from('missions')
    .select('id, target_count, reward_gold, reward_exp, reward_item_id')
    .eq('session_id', sessionId)
    .eq('type', 'walk')

  if (!walkMissions?.length) return

  // Load existing player_missions entries
  const missionIds = walkMissions.map((m: any) => m.id)
  const { data: playerMissions } = await supabase
    .from('player_missions')
    .select('id, mission_id, progress, completed_at')
    .eq('user_id', userId)
    .in('mission_id', missionIds)

  const pmMap: Record<string, any> = Object.fromEntries(
    (playerMissions ?? []).map((pm: any) => [pm.mission_id, pm])
  )

  for (const mission of walkMissions as any[]) {
    const existing = pmMap[mission.id]
    if (existing?.completed_at) continue // already done

    const newProgress = Math.min(mission.target_count, stepsWalked)

    if (!existing) {
      const justCompleted = newProgress >= mission.target_count
      await supabase.from('player_missions').insert({
        user_id: userId,
        mission_id: mission.id,
        progress: newProgress,
        ...(justCompleted ? { completed_at: new Date().toISOString() } : {}),
      })
      if (justCompleted) await grantMissionReward(mission, userId, sessionId)
    } else if (newProgress > existing.progress) {
      const justCompleted = newProgress >= mission.target_count
      await supabase.from('player_missions').update({
        progress: newProgress,
        ...(justCompleted ? { completed_at: new Date().toISOString() } : {}),
      }).eq('id', existing.id)
      if (justCompleted) await grantMissionReward(mission, userId, sessionId)
    }
  }
}

async function grantMissionReward(
  mission: { reward_gold: number; reward_exp: number; reward_item_id: string | null },
  userId: string,
  sessionId: string,
) {
  const admin = createAdminClient()
  await Promise.all([
    // Gold
    mission.reward_gold > 0
      ? admin
          .from('player_sessions')
          .select('gold')
          .eq('user_id', userId)
          .eq('session_id', sessionId)
          .single()
          .then(({ data }) => {
            if (data) {
              return admin
                .from('player_sessions')
                .update({ gold: (data.gold ?? 0) + mission.reward_gold })
                .eq('user_id', userId)
                .eq('session_id', sessionId)
            }
          })
      : Promise.resolve(),

    // EXP
    mission.reward_exp > 0
      ? admin.rpc('increment_player_stats', {
          p_user_id: userId,
          p_session_id: sessionId,
          p_exp: mission.reward_exp,
          p_score: 0,
        })
      : Promise.resolve(),

    // Item
    mission.reward_item_id
      ? admin
          .from('player_inventory')
          .select('id, quantity')
          .eq('user_id', userId)
          .eq('session_id', sessionId)
          .eq('item_id', mission.reward_item_id)
          .maybeSingle()
          .then(({ data: existing }) => {
            if (existing) {
              return admin
                .from('player_inventory')
                .update({ quantity: existing.quantity + 1 })
                .eq('id', existing.id)
            } else {
              return admin.from('player_inventory').insert({
                user_id: userId,
                session_id: sessionId,
                item_id: mission.reward_item_id,
                quantity: 1,
              })
            }
          })
      : Promise.resolve(),
  ])
}
