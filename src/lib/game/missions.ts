import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser, getDisplayName, pickOne } from '@/lib/push'
import { getMissionUnlockState, type MissionUnlockContext, type MissionUnlockFields } from '@/lib/game/mission-unlocks'
import { TUTORIAL_MISSION_FRAMMENTO_GRANTS, isTutorialSession } from '@/lib/game/tutorial'
import { grantAbility } from '@/lib/game/grant-ability'

interface MissionRow {
  id: string
  title: string
  target: string
  target_count: number
  reward_gold: number
  reward_exp: number
  reward_item_id: string | null
  reward_ability_id: string | null
  reward_items: Array<{ item_id: string; quantity: number }> | null
  reward_creature_id: string | null
  unlock_level: number | null
  unlock_after_mission_id: string | null
}

interface PlayerMissionProgressRow {
  id: string
  mission_id: string
  progress: number
  completed_at: string | null
}

interface GoldRow { gold: number }
interface InventoryRow { id: string; quantity: number }
interface PlayerCreatureRow { id: string; duplicates_count: number }

export interface CompletedMission {
  /** Original mission id — lets the client key tutorial-moment modals
   *  by mission UUID (see TUTORIAL_MISSION_MOMENTS in tutorial.ts). */
  missionId?: string
  title: string
  rewardGold: number
  rewardExp: number
  levelUp?: { newLevel: number; goldReward: number } | null
  /** Present when this mission completion granted a tutorial enigma
   *  frammento. The client uses it to surface a "🧩 nuovo frammento"
   *  toast alongside the mission reward. */
  tutorialFrammentoGranted?: { frammentoId: string; title: string } | null
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

  // Load matching missions for this session and type. Real events also
  // pull "global" missions (session_id IS NULL); the tutorial session is
  // intentionally isolated so its mission list stays a clean, scripted
  // story without globals bleeding into it.
  const missionQuery = admin
    .from('missions')
    .select('id, title, target, target_count, reward_gold, reward_exp, reward_item_id, reward_ability_id, reward_items, reward_creature_id, unlock_level, unlock_after_mission_id')
    .eq('type', type)
  const { data: missions } = await (
    isTutorialSession(sessionId)
      ? missionQuery.eq('session_id', sessionId)
      : missionQuery.or(`session_id.eq.${sessionId},session_id.is.null`)
  )

  if (!missions?.length) return []

  // Match missions: empty mission.target = matches anything; otherwise compare case-insensitively
  // against one or more event targets (qr id/manual code/label, etc).
  const matching = (missions as MissionRow[]).filter(m =>
    missionMatchesTarget(m.target, eventTargets)
  )
  if (!matching.length) return []

  const unlockContext = await loadMissionUnlockContext(admin, userId, sessionId, matching)
  const unlockedMatching = matching.filter(m =>
    getMissionUnlockState(m, unlockContext).unlocked
  )
  if (!unlockedMatching.length) return []

  // Load existing player_missions entries — scoped to this session so global
  // missions can be replayed in a new session (migration 027).
  const missionIds = unlockedMatching.map(m => m.id)
  const { data: playerMissions } = await admin
    .from('player_missions')
    .select('id, mission_id, progress, completed_at')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .in('mission_id', missionIds)

  const pmMap: Record<string, PlayerMissionProgressRow> = Object.fromEntries(
    ((playerMissions ?? []) as PlayerMissionProgressRow[]).map(pm => [pm.mission_id, pm])
  )

  const completed: CompletedMission[] = []

  for (const mission of unlockedMatching) {
    const existing = pmMap[mission.id]
    if (existing?.completed_at) continue  // already completed in this session

    const newProgress = (existing?.progress ?? 0) + 1
    const justCompleted = newProgress >= mission.target_count

    let writeOk: boolean
    if (!existing) {
      const { error: insertErr } = await admin.from('player_missions').insert({
        user_id: userId,
        session_id: sessionId,
        mission_id: mission.id,
        progress: newProgress,
        ...(justCompleted ? { completed_at: new Date().toISOString() } : {}),
      })
      // Race: another concurrent request already inserted this row. Skip so
      // we don't grant the reward twice (the other request will).
      if (insertErr?.code === '23505') continue
      writeOk = !insertErr
    } else {
      const { error: updateErr } = await admin.from('player_missions').update({
        progress: newProgress,
        ...(justCompleted ? { completed_at: new Date().toISOString() } : {}),
      }).eq('id', existing.id)
      writeOk = !updateErr
    }

    // DB write failed: don't grant reward, otherwise the next event sees the
    // old progress, re-completes, and dispenses the reward again (phantom loop).
    if (!writeOk) continue

    if (justCompleted) {
      const levelUp = await grantMissionReward(mission, userId, sessionId, admin)

      // Tutorial-only: hand out a specific enigma frammento when certain
      // tutorial missions complete. This is how the player learns that
      // catching creatures + scanning special targets contributes to enigma
      // progress, without needing a real frammento-bearing creature pool.
      let tutorialFrammentoGranted:
        | { frammentoId: string; title: string }
        | null = null
      const frammentoId = TUTORIAL_MISSION_FRAMMENTO_GRANTS[mission.id]
      if (frammentoId) {
        const { error: upsertErr } = await admin
          .from('player_enigma_frammenti')
          .upsert(
            {
              user_id: userId,
              session_id: sessionId,
              frammento_id: frammentoId,
            },
            { onConflict: 'user_id,session_id,frammento_id', ignoreDuplicates: true },
          )
        if (!upsertErr) {
          // Fetch the frammento title so the client can show it in the
          // toast. Best-effort — if this lookup fails we still grant the
          // frammento above, we just won't have a fancy title to display.
          const { data: frammento } = await admin
            .from('enigma_frammenti')
            .select('title')
            .eq('id', frammentoId)
            .maybeSingle()
          if (frammento?.title) {
            tutorialFrammentoGranted = { frammentoId, title: frammento.title }
          }
        }
      }

      // Game events for bell history
      admin.from('player_game_events').insert({
        user_id: userId,
        session_id: sessionId,
        type: 'mission_completed',
        payload: {
          mission_id:     mission.id,
          mission_target: mission.target,
          target_count:   mission.target_count,
          title:          mission.title,
          reward_gold:    mission.reward_gold,
          reward_exp:     mission.reward_exp,
        },
      }).then(undefined, () => {})
      if (levelUp) {
        admin.from('player_game_events').insert({
          user_id: userId,
          session_id: sessionId,
          type: 'level_up',
          payload: { new_level: levelUp.newLevel, gold_reward: levelUp.goldReward },
        }).then(undefined, () => {})
      }
      completed.push({
        missionId: mission.id,
        title: mission.title,
        rewardGold: mission.reward_gold,
        rewardExp: mission.reward_exp,
        levelUp,
        tutorialFrammentoGranted,
      })
      after(async () => {
        const nick = await getDisplayName(userId)
        const who = nick ? `${nick}, ` : ''
        const rw = [
          mission.reward_gold ? `+${mission.reward_gold} 🪙` : '',
          mission.reward_exp ? `+${mission.reward_exp} ⭐` : '',
        ].filter(Boolean).join(' · ')
        const title = pickOne(['🎯 Missione completata!', '✅ Obiettivo raggiunto!', '🏅 Ben fatto!'])
        const body = pickOne([
          `${who}"${mission.title}" completata.${rw ? ` Ricompensa: ${rw}.` : ''}`,
          `${who}hai portato a termine "${mission.title}".${rw ? ` ${rw}` : ''}`,
          `${who}"${mission.title}" è fatta.${rw ? ` Incassati ${rw}.` : ''}`,
        ])
        await sendPushToUser(userId, { title, body, url: '/game/missions', tag: `mission_${mission.id}` })
      })
    }
  }

  return completed
}

export async function loadMissionUnlockContext(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  sessionId: string,
  missions: MissionUnlockFields[],
): Promise<MissionUnlockContext> {
  const prerequisiteIds = [...new Set(
    missions
      .map(m => m.unlock_after_mission_id)
      .filter((id): id is string => !!id),
  )]

  const [{ data: playerSession }, { data: completedRows }, { data: prerequisiteRows }] = await Promise.all([
    admin
      .from('player_sessions')
      .select('level')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .maybeSingle(),
    prerequisiteIds.length
      ? admin
          .from('player_missions')
          .select('mission_id')
          .eq('user_id', userId)
          .in('mission_id', prerequisiteIds)
          .not('completed_at', 'is', null)
          // Intentionally cross-session: completing a prerequisite in any session
          // should unlock the next mission in a new session too.
      : Promise.resolve({ data: [] }),
    prerequisiteIds.length
      ? admin
          .from('missions')
          .select('id, title')
          .in('id', prerequisiteIds)
      : Promise.resolve({ data: [] }),
  ])

  return {
    playerLevel: typeof playerSession?.level === 'number' ? playerSession.level : 1,
    completedMissionIds: ((completedRows ?? []) as Array<{ mission_id: string }>).map(row => row.mission_id),
    missionTitleById: Object.fromEntries(
      ((prerequisiteRows ?? []) as Array<{ id: string; title: string | null }>).map(row => [row.id, row.title]),
    ),
  }
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
    const goldRow = ps as GoldRow | null
    if (goldRow) {
      await admin.from('player_sessions')
        .update({ gold: goldRow.gold + mission.reward_gold })
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
    const inventoryRow = existing as InventoryRow | null
    if (inventoryRow) {
      await admin.from('player_inventory')
        .update({ quantity: inventoryRow.quantity + ri.quantity })
        .eq('id', inventoryRow.id)
    } else {
      await admin.from('player_inventory').insert({
        user_id: userId,
        session_id: sessionId,
        item_id: ri.item_id,
        quantity: ri.quantity,
      })
    }
  }

  // Ability token reward
  if (mission.reward_ability_id) {
    await grantAbility(admin, userId, sessionId, mission.reward_ability_id, 1)
  }

  // Creature reward
  if (mission.reward_creature_id) {
    const { data: existing } = await admin.from('player_creatures')
      .select('id, duplicates_count')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('creature_id', mission.reward_creature_id)
      .maybeSingle()
    const creatureRow = existing as PlayerCreatureRow | null
    if (creatureRow) {
      await admin.from('player_creatures')
        .update({ duplicates_count: creatureRow.duplicates_count + 1 })
        .eq('id', creatureRow.id)
    } else {
      await admin.from('player_creatures').upsert({
        user_id: userId,
        creature_id: mission.reward_creature_id,
        session_id: sessionId,
        duplicates_count: 1,
      }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
    }
  }

  return levelUp
}
