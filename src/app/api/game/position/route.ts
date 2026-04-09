import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isWithinBounds, haversineDistance, parsePoint } from '@/lib/game/anti-cheat'

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

  // PostgreSQL POINT columns are returned by PostgREST as the string "(lng,lat)"
  const prevPos = parsePoint(playerSession.last_position)

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

  // Step accumulation: only when session is active, in bounds, good accuracy, 0.5–500m moved
  // (session.status === 'active' ensures steps don't count while waiting in 'ready' state)
  const validStep = session.status === 'active' && inBounds && goodAccuracy && distanceMoved >= 0.5 && distanceMoved < 500
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

  // Walk mission progress + egg hatching: update whenever steps change
  let eggsHatched: Array<{ name: string; rarity: string; element: string }> = []
  let completedMissions: Array<{ title: string; rewardGold: number; rewardExp: number }> = []
  if (stepsIncrement > 0 && session.status === 'active') {
    const [missions, hatched] = await Promise.all([
      updateWalkMissions(sessionId, user.id, newStepsWalked, supabase),
      checkAndHatchEggs(sessionId, user.id, newStepsWalked, supabase),
    ])
    completedMissions = missions
    eggsHatched = hatched
  }

  // Encounter trigger: only when in bounds, session active, moved ≥5m, good accuracy
  let triggerEncounter = false
  if (inBounds && session.status === 'active') {
    if (goodAccuracy && distanceMoved >= 5) {
      triggerEncounter = Math.random() < 0.30  // 30% per ≥5 m step
    }
  }

  return NextResponse.json({ valid: true, inBounds, triggerEncounter, sessionStatus: session.status, stepsWalked: newStepsWalked, distanceMoved, eggsHatched, completedMissions })
}

async function updateWalkMissions(
  sessionId: string,
  userId: string,
  stepsWalked: number,
  supabase: any,
): Promise<Array<{ title: string; rewardGold: number; rewardExp: number }>> {
  // Load walk missions for this session (session-scoped OR global)
  const { data: walkMissions } = await supabase
    .from('missions')
    .select('id, title, target_count, reward_gold, reward_exp, reward_item_id')
    .or(`session_id.eq.${sessionId},session_id.is.null`)
    .eq('type', 'walk')

  if (!walkMissions?.length) return []

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

  const justCompletedMissions: Array<{ title: string; rewardGold: number; rewardExp: number }> = []

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
      if (justCompleted) {
        await grantMissionReward(mission, userId, sessionId)
        justCompletedMissions.push({ title: mission.title, rewardGold: mission.reward_gold, rewardExp: mission.reward_exp })
      }
    } else if (newProgress > existing.progress) {
      const justCompleted = newProgress >= mission.target_count
      await supabase.from('player_missions').update({
        progress: newProgress,
        ...(justCompleted ? { completed_at: new Date().toISOString() } : {}),
      }).eq('id', existing.id)
      if (justCompleted) {
        await grantMissionReward(mission, userId, sessionId)
        justCompletedMissions.push({ title: mission.title, rewardGold: mission.reward_gold, rewardExp: mission.reward_exp })
      }
    }
  }

  return justCompletedMissions
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

// Rarity pool for egg hatching (mirrors eggs/[id]/route.ts)
const EGG_RARITY_POOLS: Record<string, Array<{ rarity: string; weight: number }>> = {
  comune:      [{ rarity: 'comune', weight: 1 }],
  non_comune:  [{ rarity: 'comune', weight: 70 }, { rarity: 'non_comune', weight: 30 }],
  raro:        [{ rarity: 'comune', weight: 50 }, { rarity: 'non_comune', weight: 30 }, { rarity: 'raro',       weight: 20 }],
  epico:       [{ rarity: 'comune', weight: 40 }, { rarity: 'non_comune', weight: 30 }, { rarity: 'raro',       weight: 20 }, { rarity: 'epico',      weight: 10 }],
  leggendario: [{ rarity: 'comune', weight: 35 }, { rarity: 'non_comune', weight: 25 }, { rarity: 'raro',       weight: 20 }, { rarity: 'epico',      weight: 15 }, { rarity: 'leggendario', weight: 5 }],
  mitologico:  [{ rarity: 'comune', weight: 30 }, { rarity: 'non_comune', weight: 25 }, { rarity: 'raro',       weight: 20 }, { rarity: 'epico',      weight: 15 }, { rarity: 'leggendario', weight: 8 }, { rarity: 'mitologico', weight: 2 }],
}

function pickEggRarity(eggRarity: string): string {
  const pool = EGG_RARITY_POOLS[eggRarity] ?? EGG_RARITY_POOLS['comune']
  const total = pool.reduce((s, e) => s + e.weight, 0)
  let roll = Math.random() * total
  for (const entry of pool) {
    roll -= entry.weight
    if (roll <= 0) return entry.rarity
  }
  return pool[pool.length - 1].rarity
}

async function checkAndHatchEggs(
  sessionId: string,
  userId: string,
  stepsWalked: number,
  supabase: any,
): Promise<Array<{ name: string; rarity: string; element: string }>> {
  const { data: eggs } = await supabase
    .from('player_eggs')
    .select('id, egg_rarity, steps_required, steps_at_pickup')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .is('hatched_at', null)

  if (!eggs?.length) return []

  const readyEggs = (eggs as any[]).filter(egg =>
    egg.steps_required === 0 || (stepsWalked - egg.steps_at_pickup) >= egg.steps_required
  )
  if (!readyEggs.length) return []

  const hatched: Array<{ name: string; rarity: string; element: string }> = []

  for (const egg of readyEggs) {
    const targetRarity = pickEggRarity(egg.egg_rarity)

    const { data: candidates } = await supabase
      .from('creatures')
      .select('id, name, rarity, element')
      .eq('rarity', targetRarity)
      .limit(100)

    let pool: any[] = candidates ?? []
    if (!pool.length) {
      const { data: fallback } = await supabase
        .from('creatures').select('id, name, rarity, element').eq('rarity', 'comune').limit(50)
      pool = fallback ?? []
    }
    if (!pool.length) continue

    const picked = pool[Math.floor(Math.random() * pool.length)]

    // Add to collection or increment duplicates
    const { data: existing } = await supabase
      .from('player_creatures')
      .select('id, duplicates_count')
      .eq('user_id', userId)
      .eq('creature_id', picked.id)
      .eq('session_id', sessionId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('player_creatures')
        .update({ duplicates_count: existing.duplicates_count + 1 })
        .eq('id', existing.id)
    } else {
      await supabase.from('player_creatures').insert({
        user_id: userId,
        creature_id: picked.id,
        session_id: sessionId,
        duplicates_count: 1,
      })
    }

    await supabase
      .from('player_eggs')
      .update({ hatched_at: new Date().toISOString(), hatched_creature_id: picked.id })
      .eq('id', egg.id)

    hatched.push({ name: picked.name, rarity: picked.rarity, element: picked.element })
  }

  return hatched
}
