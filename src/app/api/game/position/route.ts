import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { isWithinBounds, haversineDistance, parsePoint } from '@/lib/game/anti-cheat'
import { loadMissionUnlockContext } from '@/lib/game/missions'
import { getMissionUnlockState } from '@/lib/game/mission-unlocks'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { evaluateStep, shouldRollEncounter, STEP_FILTER } from '@/lib/game/step-counter'
import { isTutorialSession } from '@/lib/game/tutorial'

type SupabaseLike = ReturnType<typeof createAdminClient>

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('position', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const body = await request.json().catch(() => ({}))
  const { lat, lng, accuracy, sessionId } = body
  // The client's authoritative optimistic total (committed steps + the
  // pending bucket). The client counter is the one the player actually
  // sees on the map; without adopting it here the server lags behind by
  // everything that accumulated between throttled POSTs + any local
  // re-localization commits, so the backpack/eggs/missions show a lower
  // number than the map and walk-gated rewards (egg hatch, walk mission)
  // fire late or not at all. Anti-cheat is explicitly out of scope for
  // this game; we still sanity-clamp below so a bug can't write garbage.
  const clientSteps =
    typeof body.clientSteps === 'number' && Number.isFinite(body.clientSteps)
      ? Math.max(0, Math.floor(body.clientSteps))
      : null

  if (typeof lat !== 'number' || typeof lng !== 'number' || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Get player session and session details in parallel
  const [{ data: playerSession }, { data: session }] = await Promise.all([
    supabase
      .from('player_sessions')
      .select('id, last_position, last_position_at, steps_walked')
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

  // All step-counting / SNR / velocity filtering lives in step-counter.ts —
  // see src/lib/game/__tests__/step-counter.test.ts for the contract.
  const nowMs = Date.now()
  const lastPositionAtMs = playerSession.last_position_at
    ? new Date(playerSession.last_position_at).getTime()
    : null
  const elapsedMs = lastPositionAtMs ? Math.max(1, nowMs - lastPositionAtMs) : null

  const step = evaluateStep({
    distanceMoved,
    accuracy: typeof accuracy === 'number' ? accuracy : Infinity,
    elapsedMs,
    sessionStatus: session.status,
    inBounds,
  })
  const { validStep, stepsIncrement, shouldUpdateBaseline } = step
  const prevSteps = playerSession.steps_walked ?? 0
  const serverComputed = prevSteps + stepsIncrement

  // ── Adopt the client's optimistic total ───────────────────────────────
  // The client is the source of truth for the visible counter. We take
  // max(serverComputed, clientSteps) so the persisted total matches what
  // the player sees — eliminating the map↔backpack discrepancy and making
  // walk-gated rewards fire exactly when the on-screen counter says.
  //
  // Sanity clamp (NOT anti-cheat — just bug insurance): the client total
  // can't legitimately exceed prevSteps + (max walking speed × elapsed)
  // plus a generous buffer for bucket/commit slack. With no elapsed
  // (first fix / long resume gap) we can't bound it, so we trust the
  // cached client value as-is — it was itself produced by the same
  // bounded local pipeline.
  let adoptedClient = 0
  if (clientSteps !== null && clientSteps > serverComputed) {
    if (elapsedMs === null) {
      adoptedClient = clientSteps
    } else {
      const elapsedSec = elapsedMs / 1000
      const maxPlausibleGain = elapsedSec * STEP_FILTER.MAX_SPEED_MPS + 60 // +60 m slack
      const ceiling = prevSteps + Math.ceil(maxPlausibleGain)
      adoptedClient = Math.min(clientSteps, ceiling)
    }
  }
  const effectiveSteps = Math.max(serverComputed, adoptedClient)
  const stepsAdvanced = effectiveSteps > prevSteps

  if (shouldUpdateBaseline) {
    await supabase
      .from('player_sessions')
      .update({
        last_position: `(${lng},${lat})`,
        last_position_at: new Date(nowMs).toISOString(),
        ...(stepsAdvanced ? { steps_walked: effectiveSteps } : {}),
      })
      .eq('id', playerSession.id)
  } else if (stepsAdvanced) {
    await supabase
      .from('player_sessions')
      .update({ steps_walked: effectiveSteps })
      .eq('id', playerSession.id)
  }

  // Walk mission progress + egg hatching: run whenever the effective
  // total advanced — NOT just when the server's own per-POST haversine
  // credited something. A flush POST may carry a client total that
  // crosses a threshold even though this single segment's distance was
  // tiny; we still want the egg to hatch / mission to complete now.
  let eggsHatched: Array<{ name: string; rarity: string; element: string; image_url?: string | null; sprite_cutout_url?: string | null; sprite_url?: string | null }> = []
  let completedMissions: Array<{ title: string; rewardGold: number; rewardExp: number }> = []
  if (stepsAdvanced && session.status === 'active') {
    const [missions, hatched] = await Promise.all([
      updateWalkMissions(sessionId, user.id, effectiveSteps, supabase),
      checkAndHatchEggs(sessionId, user.id, effectiveSteps, supabase),
    ])
    completedMissions = missions
    eggsHatched = hatched
  }

  // Encounter trigger: piggy-backs on the same anti-noise filter as steps.
  // A "move" we wouldn't count as walking shouldn't spawn an encounter either.
  const triggerEncounter = shouldRollEncounter(step, distanceMoved) && Math.random() < 0.30

  // Return validated distance only — the client uses this for its fallback
  // encounter accumulator (cumDistRef), which must not grow on rejected fixes.
  const reportedDistance = validStep ? distanceMoved : 0

  return NextResponse.json({ valid: true, inBounds, triggerEncounter, sessionStatus: session.status, stepsWalked: effectiveSteps, distanceMoved: reportedDistance, eggsHatched, completedMissions })
}

async function updateWalkMissions(
  sessionId: string,
  userId: string,
  stepsWalked: number,
  supabase: SupabaseLike,
): Promise<Array<{ title: string; rewardGold: number; rewardExp: number }>> {
  type WalkMission = {
    id: string
    title: string
    target_count: number
    reward_gold: number
    reward_exp: number
    reward_item_id: string | null
    unlock_level: number | null
    unlock_after_mission_id: string | null
  }

  // Load walk missions. Real events include globals; tutorial is isolated.
  const walkBase = supabase
    .from('missions')
    .select('id, title, target_count, reward_gold, reward_exp, reward_item_id, unlock_level, unlock_after_mission_id')
    .eq('type', 'walk')
  const { data: walkMissions } = await (isTutorialSession(sessionId)
    ? walkBase.eq('session_id', sessionId)
    : walkBase.or(`session_id.eq.${sessionId},session_id.is.null`))

  if (!walkMissions?.length) return []

  const walkMissionRows = walkMissions as WalkMission[]
  const unlockContext = await loadMissionUnlockContext(supabase, userId, sessionId, walkMissionRows)
  const unlockedWalkMissions = walkMissionRows.filter(mission =>
    getMissionUnlockState(mission, unlockContext).unlocked
  )
  if (!unlockedWalkMissions.length) return []

  // Load existing player_missions entries — scoped to this session (migration 027).
  // baseline_steps was added in migration 038; pre-existing rows read NULL
  // and we treat that as 0 to keep the old absolute-step behaviour for any
  // mission mid-progress at deploy time.
  const missionIds = unlockedWalkMissions.map(m => m.id)
  const { data: playerMissions } = await supabase
    .from('player_missions')
    .select('id, mission_id, progress, completed_at, baseline_steps')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .in('mission_id', missionIds)

  type PlayerMissionProgressRow = {
    id: string
    mission_id: string
    progress: number
    completed_at: string | null
    baseline_steps: number | null
  }
  const pmMap: Record<string, PlayerMissionProgressRow> = Object.fromEntries(
    ((playerMissions ?? []) as PlayerMissionProgressRow[]).map(pm => [pm.mission_id, pm])
  )

  const justCompletedMissions: Array<{ title: string; rewardGold: number; rewardExp: number }> = []

  for (const mission of unlockedWalkMissions) {
    const existing = pmMap[mission.id]
    if (existing?.completed_at) continue // already done

    if (!existing) {
      // First time we see this mission for this player → the player just
      // unlocked it. Capture the current step counter as the baseline and
      // start progress at 0, regardless of how many steps the player has
      // already accumulated in this session. Without this a mission that
      // unlocks mid-session (e.g. M7 in the tutorial, which becomes
      // active only after the boss is defeated) would instantly complete
      // because stepsWalked was already > target_count.
      const { error: insertErr } = await supabase.from('player_missions').insert({
        user_id: userId,
        session_id: sessionId,
        mission_id: mission.id,
        progress: 0,
        baseline_steps: stepsWalked,
      })
      if (insertErr) continue // 23505 race: another concurrent request beat us
      // No completion check on first insert: target_count > 0 by design,
      // and progress starts at 0 so completion is impossible this tick.
      continue
    }

    const baseline = existing.baseline_steps ?? 0
    const newProgress = Math.min(
      mission.target_count,
      Math.max(0, stepsWalked - baseline),
    )

    if (newProgress > existing.progress) {
      const justCompleted = newProgress >= mission.target_count
      if (justCompleted) {
        // Atomically claim the completion — only succeeds if another request hasn't done it yet
        const { data: claimed } = await supabase.from('player_missions').update({
          progress: newProgress,
          completed_at: new Date().toISOString(),
        }).eq('id', existing.id).is('completed_at', null).select('id')
        if (!claimed?.length) continue // Another concurrent request already completed this mission
        await grantMissionReward(mission, userId, sessionId)
        justCompletedMissions.push({ title: mission.title, rewardGold: mission.reward_gold, rewardExp: mission.reward_exp })
      } else {
        await supabase.from('player_missions').update({ progress: newProgress }).eq('id', existing.id)
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
    // Gold + EXP in a single atomic RPC call (increment_player_stats supports p_gold)
    (mission.reward_gold > 0 || mission.reward_exp > 0)
      ? admin.rpc('increment_player_stats', {
          p_user_id: userId,
          p_session_id: sessionId,
          p_exp: mission.reward_exp,
          p_score: 0,
          p_gold: mission.reward_gold,
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
                item_id: mission.reward_item_id!, // guarded by the truthy check above
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
  supabase: SupabaseLike,
): Promise<Array<{ name: string; rarity: string; element: string; image_url: string | null; sprite_cutout_url: string | null; sprite_url: string | null; hp: number; atk: number; def: number; description: string | null }>> {
  type EggRow = { id: string; egg_rarity: string; steps_required: number; steps_at_pickup: number }
  type HatchedCreatureRow = { id: string; name: string; rarity: string; element: string; image_url: string | null; sprite_cutout_url: string | null; sprite_url: string | null; hp: number; atk: number; def: number; description: string | null }
  const { data: eggs } = await supabase
    .from('player_eggs')
    .select('id, egg_rarity, steps_required, steps_at_pickup')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .is('hatched_at', null)

  if (!eggs?.length) return []

  const readyEggs = ((eggs ?? []) as EggRow[]).filter(egg =>
    egg.steps_required === 0 || (stepsWalked - egg.steps_at_pickup) >= egg.steps_required
  )
  if (!readyEggs.length) return []

  const hatched: Array<{ name: string; rarity: string; element: string; image_url: string | null; sprite_cutout_url: string | null; sprite_url: string | null; hp: number; atk: number; def: number; description: string | null }> = []

  for (const egg of readyEggs) {
    // Atomically claim this egg: only one concurrent request can win.
    // The WHERE hatched_at IS NULL ensures Postgres locks the row — if another
    // request already set hatched_at, this UPDATE matches 0 rows and we skip.
    const { data: claimed } = await supabase
      .from('player_eggs')
      .update({ hatched_at: new Date().toISOString() })
      .eq('id', egg.id)
      .is('hatched_at', null)
      .select('id')

    if (!claimed?.length) continue  // Another concurrent request already hatched this egg

    const targetRarity = pickEggRarity(egg.egg_rarity)

    const { data: candidates } = await supabase
      .from('creatures')
      .select('id, name, rarity, element, image_url, sprite_cutout_url, sprite_url, hp, atk, def, description')
      .eq('rarity', targetRarity)
      .limit(100)

    let pool: HatchedCreatureRow[] = (candidates ?? []) as HatchedCreatureRow[]
    if (!pool.length) {
      const { data: fallback } = await supabase
        .from('creatures').select('id, name, rarity, element, image_url, sprite_cutout_url, sprite_url, hp, atk, def, description').eq('rarity', 'comune').limit(50)
      pool = (fallback ?? []) as HatchedCreatureRow[]
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
      await supabase.from('player_creatures').upsert({
        user_id: userId,
        creature_id: picked.id,
        session_id: sessionId,
        duplicates_count: 1,
      }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
    }

    // Store which creature hatched
    await supabase
      .from('player_eggs')
      .update({ hatched_creature_id: picked.id })
      .eq('id', egg.id)

    hatched.push({
      name: picked.name,
      rarity: picked.rarity,
      element: picked.element,
      image_url: picked.image_url ?? null,
      sprite_cutout_url: picked.sprite_cutout_url ?? null,
      sprite_url: picked.sprite_url ?? null,
      hp: picked.hp,
      atk: picked.atk,
      def: picked.def,
      description: picked.description ?? null,
    })
  }

  return hatched
}
