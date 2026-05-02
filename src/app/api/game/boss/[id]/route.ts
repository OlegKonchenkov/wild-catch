import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateCombatDamage, resolveTurnStartStatus, rollCombatFortune, rollCrit, rollStatusEffect, scaleCombatStats, STATUS_EFFECT_META } from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import { getElementMultiplier } from '@/lib/game/elements'
import type { Element } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

type BossLineupSlot = {
  creature_id?: string
  status_effect?: StatusEffect | null
  status_effect_chance?: number | null
  active_status?: StatusEffect | null
  status_turns_left?: number | null
  [key: string]: unknown
}

async function hydrateBossLineupStatusFields(
  fightId: string,
  bossLineup: BossLineupSlot[] | null | undefined,
): Promise<BossLineupSlot[]> {
  const lineup = Array.isArray(bossLineup) ? bossLineup : []
  const needsHydration = lineup.some(slot =>
    slot?.creature_id && (
      slot.status_effect === undefined ||
      slot.status_effect_chance === undefined ||
      slot.active_status === undefined ||
      slot.status_turns_left === undefined
    ),
  )

  if (!needsHydration) return lineup

  const creatureIds = lineup
    .map(slot => slot?.creature_id)
    .filter((creatureId): creatureId is string => Boolean(creatureId))

  const admin = createAdminClient()
  const { data: creatureRows } = creatureIds.length > 0
    ? await admin
        .from('creatures')
        .select('id, status_effect, status_effect_chance')
        .in('id', creatureIds)
    : { data: [] }

  const creatureMap: Record<string, { status_effect: StatusEffect | null; status_effect_chance: number | null }> =
    Object.fromEntries(
      (creatureRows ?? []).map((row: any) => [
        row.id,
        {
          status_effect: (row.status_effect as StatusEffect | null) ?? null,
          status_effect_chance: row.status_effect_chance ?? 0.15,
        },
      ]),
    )

  const hydratedLineup = lineup.map(slot => {
    const creatureStatus = slot?.creature_id ? creatureMap[slot.creature_id] : null

    return {
      ...slot,
      status_effect: slot.status_effect ?? creatureStatus?.status_effect ?? null,
      status_effect_chance: slot.status_effect_chance ?? creatureStatus?.status_effect_chance ?? 0.15,
      active_status: slot.active_status ?? null,
      status_turns_left: slot.status_turns_left ?? 0,
    }
  })

  await admin
    .from('boss_fights')
    .update({ boss_lineup: hydratedLineup })
    .eq('id', fightId)

  return hydratedLineup
}

async function grantBossFightRewards({
  fight,
  fightId,
  supabase,
  userId,
}: {
  fight: Record<string, any>
  fightId: string
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
}): Promise<{
  levelUp: { newLevel: number; goldReward: number } | null
  reward: Record<string, unknown> | null
}> {
  let levelUp: { newLevel: number; goldReward: number } | null = null
  let rewardGranted = false

  const { data: priorRewardedFight } = fight.qr_code_id
    ? await supabase
        .from('boss_fights')
        .select('id')
        .eq('user_id', userId)
        .eq('qr_code_id', fight.qr_code_id)
        .eq('reward_claimed', true)
        .neq('id', fightId)
        .limit(1)
        .maybeSingle()
    : { data: null }

  if (!priorRewardedFight) {
    const { data: claimedRows } = await supabase
      .from('boss_fights')
      .update({ reward_claimed: true })
      .eq('id', fightId)
      .or('reward_claimed.is.null,reward_claimed.eq.false')
      .select('id')

    rewardGranted = (claimedRows?.length ?? 0) > 0
  } else {
    await supabase
      .from('boss_fights')
      .update({ reward_claimed: true })
      .eq('id', fightId)
      .or('reward_claimed.is.null,reward_claimed.eq.false')
  }

  if (!rewardGranted) {
    return { levelUp, reward: null }
  }

  const reward = fight.reward as {
    gold?: number
    exp?: number
    item_id?: string
    item_qty?: number
    creature_id?: string
  } | null
  const admin = createAdminClient()

  const { data: rpcData } = await admin.rpc('increment_player_stats', {
    p_user_id: userId,
    p_session_id: fight.session_id,
    p_exp: reward?.exp ?? 50,
    p_score: 20,
  })
  const rpcRow = Array.isArray(rpcData) ? rpcData[0] : null
  if (rpcRow?.leveled_up) {
    levelUp = { newLevel: rpcRow.new_level, goldReward: rpcRow.gold_reward ?? 0 }
  }

  const goldReward = (reward?.gold ?? 0) + (levelUp?.goldReward ?? 0)
  if (goldReward > 0) {
    const { data: playerSession } = await admin
      .from('player_sessions')
      .select('gold')
      .eq('user_id', userId)
      .eq('session_id', fight.session_id)
      .single()

    if (playerSession) {
      await admin
        .from('player_sessions')
        .update({ gold: (playerSession.gold ?? 0) + goldReward })
        .eq('user_id', userId)
        .eq('session_id', fight.session_id)
    }
  }

  const enrichedReward: Record<string, unknown> = { gold: goldReward, exp: reward?.exp ?? 50 }

  if (reward?.item_id) {
    const qty = reward.item_qty ?? 1
    const { data: existingInv } = await admin
      .from('player_inventory')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('session_id', fight.session_id)
      .eq('item_id', reward.item_id)
      .maybeSingle()

    if (existingInv) {
      await admin
        .from('player_inventory')
        .update({ quantity: existingInv.quantity + qty })
        .eq('id', existingInv.id)
    } else {
      await admin.from('player_inventory').insert({
        user_id: userId,
        session_id: fight.session_id,
        item_id: reward.item_id,
        quantity: qty,
      })
    }

    const { data: itemData } = await admin.from('items').select('name').eq('id', reward.item_id).single()
    enrichedReward.item_id = reward.item_id
    enrichedReward.item_qty = qty
    enrichedReward.item_name = (itemData as any)?.name ?? null
  }

  if (reward?.creature_id) {
    const { data: rewardCreature } = await admin
      .from('creatures')
      .select('id, name, rarity, element, image_url, sprite_url, hp, atk, def')
      .eq('id', reward.creature_id)
      .single()

    if (rewardCreature) {
      const { data: existingPc } = await admin
        .from('player_creatures')
        .select('id, duplicates_count')
        .eq('user_id', userId)
        .eq('session_id', fight.session_id)
        .eq('creature_id', (rewardCreature as any).id)
        .maybeSingle()

      if (existingPc) {
        await admin
          .from('player_creatures')
          .update({ duplicates_count: existingPc.duplicates_count + 1 })
          .eq('id', existingPc.id)
      } else {
        await admin.from('player_creatures').upsert({
          user_id: userId,
          creature_id: (rewardCreature as any).id,
          session_id: fight.session_id,
          duplicates_count: 1,
        }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
      }

      enrichedReward.creature = rewardCreature
    }
  }

  const bossName = (fight.boss_lineup as any[])?.[0]?.name ?? 'Boss'
  admin.from('player_game_events').insert({
    user_id: userId,
    session_id: fight.session_id,
    type: 'boss_won',
    payload: { fight_id: fightId, gold: goldReward, exp: reward?.exp ?? 50, boss_name: bossName },
  }).then(undefined, () => {})

  if (levelUp) {
    admin.from('player_game_events').insert({
      user_id: userId,
      session_id: fight.session_id,
      type: 'level_up',
      payload: { new_level: levelUp.newLevel, gold_reward: levelUp.goldReward },
    }).then(undefined, () => {})
  }

  return { levelUp, reward: enrichedReward }
}

// ── GET: load boss fight state ─────────────────────────────────────────────
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: rawFight } = await supabase
    .from('boss_fights')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!rawFight) return NextResponse.json({ error: 'Boss fight non trovato' }, { status: 404 })

  const fight = {
    ...rawFight,
    boss_lineup: await hydrateBossLineupStatusFields(rawFight.id, rawFight.boss_lineup as BossLineupSlot[]),
  }

  return NextResponse.json({ fight })
}

// ── POST: player action ────────────────────────────────────────────────────
// action: 'start' (submit lineup) | 'attack' | 'surrender'
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { action, lineup, itemId, targetPlayerCreatureId } = body

  const { data: rawFight } = await supabase
    .from('boss_fights')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!rawFight) return NextResponse.json({ error: 'Boss fight non trovato' }, { status: 404 })

  const fight = {
    ...rawFight,
    boss_lineup: await hydrateBossLineupStatusFields(rawFight.id, rawFight.boss_lineup as BossLineupSlot[]),
  }

  // ── Start: submit player lineup ──────────────────────────────────────────
  if (action === 'start') {
    if (fight.status !== 'selecting') {
      return NextResponse.json({ error: 'Battaglia già iniziata' }, { status: 409 })
    }
    if (!Array.isArray(lineup) || lineup.length < 1 || lineup.length > 3) {
      return NextResponse.json({ error: 'Seleziona da 1 a 3 creature' }, { status: 400 })
    }

    const { data: playerSession } = await supabase
      .from('player_sessions')
      .select('level')
      .eq('user_id', user.id)
      .eq('session_id', fight.session_id)
      .maybeSingle()
    const playerLevel = playerSession?.level ?? 1

    // Validate ownership & fetch creature data (no sound fields — those are non-critical)
    const pcIds = lineup.map((e: any) => e.playerCreatureId)
    const { data: pcs } = await supabase
      .from('player_creatures')
      .select('id, creatures(id, name, element, rarity, hp, atk, def, image_url, status_effect, status_effect_chance)')
      .in('id', pcIds)
      .eq('user_id', user.id)

    if (!pcs || pcs.length !== lineup.length) {
      return NextResponse.json({ error: 'Creature non valide' }, { status: 400 })
    }

    const pcMap: Record<string, any> = Object.fromEntries(
      pcs.map((pc: any) => [pc.id, pc])
    )

    // Try to fetch sound data separately (requires 018_attack_sound migration; skipped if missing)
    const creatureIds = pcs.map((pc: any) => pc.creatures?.id).filter(Boolean)
    const soundMap: Record<string, { url: string | null; ms: number | null }> = {}
    const { data: soundRows } = await supabase
      .from('creatures')
      .select('id, attack_sound_url, attack_sound_duration_ms')
      .in('id', creatureIds)
    if (soundRows) {
      for (const r of soundRows as any[]) {
        soundMap[r.id] = { url: r.attack_sound_url ?? null, ms: r.attack_sound_duration_ms ?? null }
      }
    }

    const playerLineup = lineup.map((e: any, i: number) => {
      const pc = pcMap[e.playerCreatureId]
      const cr = pc?.creatures
      const crId = cr?.id as string | undefined
      const scaledStats = scaleCombatStats(
        { hp: cr?.hp ?? 100, atk: cr?.atk ?? 10, def: cr?.def ?? 0 },
        playerLevel,
      )
      return {
        slot: i,
        player_creature_id: e.playerCreatureId,
        name: cr?.name ?? 'Creatura',
        element: cr?.element ?? 'armonia',
        rarity: cr?.rarity ?? 'comune',
        level: playerLevel,
        atk: scaledStats.atk,
        def: scaledStats.def,
        max_hp: scaledStats.hp,
        current_hp: scaledStats.hp,
        fainted: false,
        is_active: i === 0,
        image_url: cr?.image_url ?? '',
        attack_sound_url: crId ? (soundMap[crId]?.url ?? null) : null,
        attack_sound_duration_ms: crId ? (soundMap[crId]?.ms ?? null) : null,
        status_effect: cr?.status_effect ?? null,
        status_effect_chance: cr?.status_effect_chance ?? 0.15,
        active_status: null,
        status_turns_left: 0,
      }
    })

    await supabase
      .from('boss_fights')
      .update({ status: 'active', player_lineup: playerLineup, player_active_slot: 0 })
      .eq('id', id)

    return NextResponse.json({ started: true, playerLineup, bossLineup: fight.boss_lineup })
  }

  // ── Surrender ────────────────────────────────────────────────────────────
  if (action === 'surrender') {
    if (!['selecting', 'active'].includes(fight.status)) {
      return NextResponse.json({ error: 'Battaglia già terminata' }, { status: 409 })
    }
    await supabase
      .from('boss_fights')
      .update({ status: 'lost', ended_at: new Date().toISOString() })
      .eq('id', id)
    const adminSurr = createAdminClient()
    const bossNameSurr = (fight.boss_lineup as any[])?.[0]?.name ?? 'Boss'
    adminSurr.from('player_game_events').insert({
      user_id: user.id, session_id: fight.session_id, type: 'boss_lost',
      payload: { fight_id: id, boss_name: bossNameSurr },
    }).then(undefined, () => {})
    return NextResponse.json({ surrendered: true })
  }

  // ── Heal ────────────────────────────────────────────────────────────────
  if (action === 'heal') {
    if (fight.status !== 'active') {
      return NextResponse.json({ error: 'Battaglia non attiva' }, { status: 409 })
    }
    if (!itemId) return NextResponse.json({ error: 'itemId richiesto' }, { status: 400 })

    const { data: healInvItem } = await supabase
      .from('player_inventory')
      .select('id, quantity, items(effect_value, type)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .eq('session_id', fight.session_id)
      .single()

    const healInv = healInvItem as { id: string; quantity: number; items: { effect_value: number; type: string } } | null
    if (!healInv || healInv.quantity <= 0 || healInv.items?.type !== 'cura') {
      return NextResponse.json({ error: 'Oggetto non valido' }, { status: 400 })
    }

    const healPlayerLineup: any[] = fight.player_lineup
    const healBossLineup: any[] = fight.boss_lineup
    const healPlayerActive = healPlayerLineup.find((c: any) => c.is_active && !c.fainted)
    const healBossActive = healBossLineup[fight.boss_active_slot]

    if (!healPlayerActive) return NextResponse.json({ error: 'Nessuna creatura attiva' }, { status: 400 })
    if (!healBossActive || healBossActive.fainted) return NextResponse.json({ error: 'Boss già sconfitto' }, { status: 400 })

    const playerStatusTick = resolveTurnStartStatus({
      effect: healPlayerActive.active_status as StatusEffect | null,
      turnsLeft: healPlayerActive.status_turns_left ?? 0,
      currentHp: healPlayerActive.current_hp,
      maxHp: healPlayerActive.max_hp,
      atk: healPlayerActive.atk,
      def: healPlayerActive.def ?? 0,
    })
    healPlayerActive.active_status = playerStatusTick.nextEffect
    healPlayerActive.status_turns_left = playerStatusTick.nextTurnsLeft
    healPlayerActive.current_hp = playerStatusTick.currentHp
    if (playerStatusTick.fainted) healPlayerActive.fainted = true

    const statusTickEvents: Record<string, unknown>[] = []
    let preTurnStatusEvent: Record<string, unknown> | null = null
    if (playerStatusTick.event?.type === 'veleno') {
      statusTickEvents.push({ ...playerStatusTick.event, target: 'player' })
    } else {
      preTurnStatusEvent = playerStatusTick.event
    }

    let skipHeal = playerStatusTick.preventedAction
    let skipBossAttack = false
    let healPlayerActiveSlot = fight.player_active_slot
    let playerSwitchedTo: string | null = null

    if (healPlayerActive.fainted) {
      healPlayerActive.is_active = false
      const nextIdx = healPlayerLineup.findIndex((c: any) => !c.fainted)
      if (nextIdx !== -1) {
        healPlayerLineup[nextIdx].is_active = true
        healPlayerActiveSlot = nextIdx
        playerSwitchedTo = healPlayerLineup[nextIdx].name
        skipHeal = true
        skipBossAttack = true
      }
    }

    const allPlayerFaintedFromStatus = healPlayerLineup.every((c: any) => c.fainted)
    if (allPlayerFaintedFromStatus) {
      await supabase.from('boss_fights').update({
        player_lineup: healPlayerLineup,
        boss_lineup: healBossLineup,
        player_active_slot: healPlayerActiveSlot,
        status: 'lost',
        ended_at: new Date().toISOString(),
      }).eq('id', id)

      createAdminClient().from('player_game_events').insert({
        user_id: user.id,
        session_id: fight.session_id,
        type: 'boss_lost',
        payload: { fight_id: id, boss_name: (fight.boss_lineup as any[])?.[0]?.name ?? 'Boss' },
      }).then(undefined, () => {})

      return NextResponse.json({
        healed: false,
        healAmount: 0,
        healedHp: null,
        playerHpBeforeBossAttack: playerStatusTick.currentHp,
        bossDamage: 0,
        newPlayerHp: playerStatusTick.currentHp,
        playerLineup: healPlayerLineup,
        bossLineup: healBossLineup,
        playerSwitchedTo,
        status: 'lost',
        lost: true,
        won: false,
        preTurnStatusEvent,
        statusTickEvents,
      })
    }

    let healAmount = 0
    let healedHp: number | null = null
    let consumedHealItem = false
    if (!skipHeal && !healPlayerActive.fainted) {
      healAmount = Math.round(healPlayerActive.max_hp * ((healInv.items.effect_value ?? 20) / 100))
      healedHp = Math.min(healPlayerActive.max_hp, healPlayerActive.current_hp + healAmount)
      healPlayerActive.current_hp = healedHp
      consumedHealItem = true
    }

    let playerHpBeforeBossAttack = healPlayerActive.current_hp
    let healBossActiveSlot = fight.boss_active_slot
    let bossSwitchedTo: string | null = null

    if (!healBossActive.fainted && !skipBossAttack) {
      const bossStatusTick = resolveTurnStartStatus({
        effect: healBossActive.active_status as StatusEffect | null,
        turnsLeft: healBossActive.status_turns_left ?? 0,
        currentHp: healBossActive.current_hp,
        maxHp: healBossActive.max_hp,
        atk: healBossActive.atk,
        def: healBossActive.def ?? 0,
      })
      healBossActive.active_status = bossStatusTick.nextEffect
      healBossActive.status_turns_left = bossStatusTick.nextTurnsLeft
      healBossActive.current_hp = bossStatusTick.currentHp
      if (bossStatusTick.fainted) healBossActive.fainted = true
      if (bossStatusTick.event) {
        statusTickEvents.push({ ...bossStatusTick.event, target: 'boss' })
      }
      if (bossStatusTick.preventedAction || bossStatusTick.fainted) {
        skipBossAttack = true
      }
    }

    if (healBossActive.fainted) {
      const nextBossIdx = healBossLineup.findIndex((c: any, i: number) => i > fight.boss_active_slot && !c.fainted)
      if (nextBossIdx !== -1) {
        healBossActiveSlot = nextBossIdx
        bossSwitchedTo = healBossLineup[nextBossIdx].name
      }
    }

    const allBossFaintedAfterTick = healBossLineup.every((c: any) => c.fainted)

    let bossDamage = 0
    let newPlayerHp = playerHpBeforeBossAttack
    let bossFortune: ReturnType<typeof rollCombatFortune> | null = null
    let bossCrit = false
    let bossElementMult: number | null = null

    if (!allBossFaintedAfterTick && !skipBossAttack && !healPlayerActive.fainted) {
      const counterBoss = healBossLineup[fight.boss_active_slot]
      bossElementMult = getElementMultiplier(counterBoss.element as Element, healPlayerActive.element as Element)
      bossFortune = rollCombatFortune({
        attackerLevel: counterBoss.level ?? 1,
        defenderLevel: healPlayerActive.level ?? 1,
        attackerStats: { hp: counterBoss.max_hp, atk: counterBoss.atk, def: counterBoss.def ?? 0 },
        defenderStats: { hp: healPlayerActive.max_hp, atk: healPlayerActive.atk, def: healPlayerActive.def ?? 0 },
      })
      const { isCrit: healBossCrit, critMultiplier: healBossCritMult } = rollCrit()
      bossCrit = healBossCrit
      bossDamage = calculateCombatDamage({
        attackerAtk: counterBoss.atk,
        defenderDef: healPlayerActive.def ?? 0,
        attackMultiplier: healBossCritMult,
        elementMultiplier: bossElementMult,
        varianceMultiplier: bossFortune.multiplier,
      })
      newPlayerHp = Math.max(0, healPlayerActive.current_hp - bossDamage)
      healPlayerActive.current_hp = newPlayerHp
      if (newPlayerHp === 0) healPlayerActive.fainted = true
    }

    let statusAppliedToPlayer: StatusEffect | null = null
    let playerStatusTurnsLeft = 0
    if (bossDamage > 0 && newPlayerHp > 0 && !healPlayerActive.fainted) {
      const triggered = rollStatusEffect(
        healBossActive.status_effect as StatusEffect | null,
        healBossActive.status_effect_chance,
      )
      if (triggered) {
        statusAppliedToPlayer = triggered
        playerStatusTurnsLeft = STATUS_EFFECT_META[triggered].turns
        healPlayerActive.active_status = triggered
        healPlayerActive.status_turns_left = playerStatusTurnsLeft
      }
    }

    if (newPlayerHp === 0) {
      healPlayerActive.is_active = false
      const nextIdx = healPlayerLineup.findIndex((c: any) => !c.fainted)
      if (nextIdx !== -1) {
        healPlayerLineup[nextIdx].is_active = true
        healPlayerActiveSlot = nextIdx
        playerSwitchedTo = healPlayerLineup[nextIdx].name
      }
    }

    const allHealPlayerFainted = healPlayerLineup.every((c: any) => c.fainted)
    const allHealBossFainted = healBossLineup.every((c: any) => c.fainted)

    let healStatus = fight.status
    let won = false
    if (allHealBossFainted) {
      healStatus = 'won'
      won = true
    } else if (allHealPlayerFainted) {
      healStatus = 'lost'
    }

    const updates = [
      supabase.from('boss_fights').update({
        player_lineup: healPlayerLineup,
        boss_lineup: healBossLineup,
        player_active_slot: healPlayerActiveSlot,
        boss_active_slot: healBossActiveSlot,
        ...(healStatus !== fight.status ? { status: healStatus, ended_at: new Date().toISOString() } : {}),
      }).eq('id', id),
    ]

    if (consumedHealItem) {
      updates.push(
        supabase.from('player_inventory').update({ quantity: healInv.quantity - 1 }).eq('id', itemId),
      )
    }

    await Promise.all(updates)

    let levelUp: { newLevel: number; goldReward: number } | null = null
    let reward: Record<string, unknown> | null = null

    if (won) {
      const rewardResult = await grantBossFightRewards({
        fight,
        fightId: id,
        supabase,
        userId: user.id,
      })
      levelUp = rewardResult.levelUp
      reward = rewardResult.reward
    } else if (allHealPlayerFainted) {
      const bossNameHeal = (fight.boss_lineup as any[])?.[0]?.name ?? 'Boss'
      createAdminClient().from('player_game_events').insert({
        user_id: user.id,
        session_id: fight.session_id,
        type: 'boss_lost',
        payload: { fight_id: id, boss_name: bossNameHeal },
      }).then(undefined, () => {})
    }

    return NextResponse.json({
      healed: consumedHealItem,
      healAmount,
      healedHp,
      playerHpBeforeBossAttack,
      bossDamage,
      newPlayerHp,
      bossFortune,
      bossCrit,
      bossElementMult,
      bossSwitchedTo,
      playerSwitchedTo,
      playerLineup: healPlayerLineup,
      bossLineup: healBossLineup,
      status: healStatus,
      won,
      lost: healStatus === 'lost',
      levelUp,
      reward,
      preTurnStatusEvent,
      statusTickEvents,
      statusAppliedToPlayer,
      playerStatusTurnsLeft,
    })
  }

  // ── Switch active creature ───────────────────────────────────────────────
  // Replaces the player's attack for this turn. The boss still counter-attacks
  // the incoming creature (same rule as encounter switch — switching costs a turn).
  if (action === 'switch') {
    if (fight.status !== 'active') {
      return NextResponse.json({ error: 'Battaglia non attiva' }, { status: 409 })
    }
    if (!targetPlayerCreatureId) {
      return NextResponse.json({ error: 'targetPlayerCreatureId richiesto' }, { status: 400 })
    }

    const swPlayerLineup: any[] = fight.player_lineup
    const swBossLineup:   any[] = fight.boss_lineup
    const swCurrentActive = swPlayerLineup.find((c: any) => c.is_active && !c.fainted)
    const swTargetSlot = swPlayerLineup.findIndex((c: any) => c.player_creature_id === targetPlayerCreatureId)

    if (swTargetSlot === -1) return NextResponse.json({ error: 'Creatura non valida' }, { status: 404 })
    const swTarget = swPlayerLineup[swTargetSlot]
    if (swTarget.is_active) return NextResponse.json({ error: 'Creatura già attiva' }, { status: 400 })
    if (swTarget.fainted || swTarget.current_hp <= 0) return NextResponse.json({ error: 'Creatura svenuta' }, { status: 400 })

    const swBossActive = swBossLineup[fight.boss_active_slot]
    if (!swBossActive || swBossActive.fainted) return NextResponse.json({ error: 'Boss già sconfitto' }, { status: 400 })

    // Deactivate current, activate target
    if (swCurrentActive) swCurrentActive.is_active = false
    swTarget.is_active = true
    const newPlayerActiveSlot = swTargetSlot

    // Boss status tick + counter-attack on the incoming creature
    let skipBossAttack = false
    const swBossStatusTick = resolveTurnStartStatus({
      effect: swBossActive.active_status as StatusEffect | null,
      turnsLeft: swBossActive.status_turns_left ?? 0,
      currentHp: swBossActive.current_hp,
      maxHp: swBossActive.max_hp,
      atk: swBossActive.atk,
      def: swBossActive.def ?? 0,
    })
    swBossActive.active_status = swBossStatusTick.nextEffect
    swBossActive.status_turns_left = swBossStatusTick.nextTurnsLeft
    swBossActive.current_hp = swBossStatusTick.currentHp
    if (swBossStatusTick.fainted) swBossActive.fainted = true
    if (swBossStatusTick.preventedAction || swBossStatusTick.fainted) skipBossAttack = true

    let bossDamage = 0
    let newPlayerHp = swTarget.current_hp
    if (!skipBossAttack && swBossActive.current_hp > 0) {
      const bossMult = getElementMultiplier(swBossActive.element as Element, swTarget.element as Element)
      const { critMultiplier } = rollCrit()
      bossDamage = calculateCombatDamage({
        attackerAtk: swBossActive.atk,
        defenderDef: swTarget.def ?? 0,
        attackMultiplier: critMultiplier,
        elementMultiplier: bossMult,
        varianceMultiplier: 1,
      })
      newPlayerHp = Math.max(0, swTarget.current_hp - bossDamage)
      swTarget.current_hp = newPlayerHp
      if (newPlayerHp === 0) swTarget.fainted = true
    }

    // Status roll by boss on incoming creature
    let statusAppliedToPlayer: StatusEffect | null = null
    let playerStatusTurnsLeft = 0
    if (bossDamage > 0 && newPlayerHp > 0) {
      const triggered = rollStatusEffect(swBossActive.status_effect as StatusEffect | null, swBossActive.status_effect_chance ?? 0.15)
      if (triggered) {
        statusAppliedToPlayer = triggered
        playerStatusTurnsLeft = STATUS_EFFECT_META[triggered].turns
        swTarget.active_status = triggered
        swTarget.status_turns_left = playerStatusTurnsLeft
      }
    }

    // If incoming creature fainted from the counter-attack, auto-advance
    let playerSwitchedTo: string | null = null
    let finalPlayerActiveSlot = newPlayerActiveSlot
    if (swTarget.fainted) {
      swTarget.is_active = false
      const nextIdx = swPlayerLineup.findIndex((c: any) => !c.fainted)
      if (nextIdx !== -1) {
        swPlayerLineup[nextIdx].is_active = true
        finalPlayerActiveSlot = nextIdx
        playerSwitchedTo = swPlayerLineup[nextIdx].name
      }
    }

    const allPlayerFainted = swPlayerLineup.every((c: any) => c.fainted)
    const newStatus = allPlayerFainted ? 'lost' : 'active'

    await supabase.from('boss_fights').update({
      player_lineup:      swPlayerLineup,
      boss_lineup:        swBossLineup,
      player_active_slot: finalPlayerActiveSlot,
      status:             newStatus,
      ...(newStatus !== 'active' ? { ended_at: new Date().toISOString() } : {}),
    }).eq('id', id)

    if (allPlayerFainted) {
      createAdminClient().from('player_game_events').insert({
        user_id: user.id, session_id: fight.session_id, type: 'boss_lost',
        payload: { fight_id: id, boss_name: (fight.boss_lineup as any[])?.[0]?.name ?? 'Boss' },
      }).then(undefined, () => {})
    }

    return NextResponse.json({
      switched: true,
      bossDamage,
      newPlayerHp,
      playerLineup:  swPlayerLineup,
      bossLineup:    swBossLineup,
      playerSwitchedTo,
      statusAppliedToPlayer,
      playerStatusTurnsLeft,
      status: newStatus,
      lost: allPlayerFainted,
    })
  }

  // ── Attack ───────────────────────────────────────────────────────────────
  if (action === 'attack') {
    if (fight.status !== 'active') {
      return NextResponse.json({ error: 'Battaglia non attiva' }, { status: 409 })
    }

    const playerLineup: any[] = fight.player_lineup
    const bossLineup:   any[] = fight.boss_lineup

    const playerActive = playerLineup.find((c: any) => c.is_active && !c.fainted)
    const bossActive   = bossLineup[fight.boss_active_slot]

    if (!playerActive) return NextResponse.json({ error: 'Nessuna creatura attiva' }, { status: 400 })
    if (!bossActive || bossActive.fainted) return NextResponse.json({ error: 'Boss già sconfitto' }, { status: 400 })

    // ── Status effect pre-turn (player) ──────────────────────────────────
    const playerStatus    = playerActive.active_status as StatusEffect | null
    const playerStatusTurns = playerActive.status_turns_left ?? 0
    let preTurnStatusEvent: Record<string, unknown> | null = null
    let skipPlayerAttack = false
    let statusTickEvents: Record<string, unknown>[] = []

    let skipBossAttack = false

    const playerStatusTick = resolveTurnStartStatus({
      effect: playerStatus,
      turnsLeft: playerStatusTurns,
      currentHp: playerActive.current_hp,
      maxHp: playerActive.max_hp,
      atk: playerActive.atk,
      def: playerActive.def ?? 0,
    })
    playerActive.active_status = playerStatusTick.nextEffect
    playerActive.status_turns_left = playerStatusTick.nextTurnsLeft
    playerActive.current_hp = playerStatusTick.currentHp
    if (playerStatusTick.fainted) playerActive.fainted = true
    if (playerStatusTick.event?.type === 'veleno') {
      statusTickEvents.push({ ...playerStatusTick.event, target: 'player' })
      preTurnStatusEvent = null
    } else {
      preTurnStatusEvent = playerStatusTick.event
    }
    if (playerStatusTick.preventedAction) skipPlayerAttack = true

    let preTurnPlayerSwitchedTo: string | null = null
    let preTurnPlayerActiveSlot = fight.player_active_slot
    if (playerActive.fainted) {
      playerActive.is_active = false
      const nextPlayerIdx = playerLineup.findIndex((c: any) => !c.fainted)
      if (nextPlayerIdx !== -1) {
        playerLineup[nextPlayerIdx].is_active = true
        preTurnPlayerActiveSlot = nextPlayerIdx
        preTurnPlayerSwitchedTo = playerLineup[nextPlayerIdx].name
        skipPlayerAttack = true
        skipBossAttack = true
      }
    }

    // Early exit if all player fainted from status
    if (playerLineup.every((c: any) => c.fainted)) {
      await supabase.from('boss_fights').update({
        player_lineup: playerLineup, boss_lineup: bossLineup,
        status: 'lost', ended_at: new Date().toISOString(),
      }).eq('id', id)
      createAdminClient().from('player_game_events').insert({
        user_id: user.id, session_id: fight.session_id, type: 'boss_lost',
        payload: { fight_id: id, boss_name: (fight.boss_lineup as any[])?.[0]?.name ?? 'Boss' },
      }).then(undefined, () => {})
      return NextResponse.json({
        statusTick: true, statusTickEvents, preTurnStatusEvent, playerLineup, bossLineup,
        status: 'lost', lost: true, playerDamage: 0, bossDamage: 0,
      })
    }

    // ── Optional battaglia item ──────────────────────────────────────────
    let atkMultiplier = 1
    if (itemId && !skipPlayerAttack && !playerActive.fainted && !bossActive.fainted) {
      const { data: invItem } = await supabase
        .from('player_inventory')
        .select('quantity, items(effect_value, type)')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .single()
      const inv = invItem as { quantity: number; items: { effect_value: number; type: string } } | null
      if (inv && inv.quantity > 0 && inv.items?.type === 'battaglia') {
        atkMultiplier = 1 + (inv.items.effect_value ?? 0) / 100
        await supabase.from('player_inventory').update({ quantity: inv.quantity - 1 }).eq('id', itemId)
      }
    }

    // ── Player → Boss ────────────────────────────────────────────────────
    const playerMult   = getElementMultiplier(playerActive.element as Element, bossActive.element as Element)
    let playerFortune = null
    let playerCrit = false
    let playerDamage = 0
    if (!skipPlayerAttack && !playerActive.fainted && !bossActive.fainted) {
      playerFortune = rollCombatFortune({
        attackerLevel: playerActive.level ?? 1,
        defenderLevel: bossActive.level ?? 1,
        attackerStats: { hp: playerActive.max_hp, atk: playerActive.atk, def: playerActive.def ?? 0 },
        defenderStats: { hp: bossActive.max_hp, atk: bossActive.atk, def: bossActive.def ?? 0 },
      })
      const { isCrit: pc, critMultiplier: pcm } = rollCrit()
      playerCrit = pc
      playerDamage = calculateCombatDamage({
        attackerAtk: playerActive.atk,
        defenderDef: bossActive.def ?? 0,
        attackMultiplier: atkMultiplier * pcm,
        elementMultiplier: playerMult,
        varianceMultiplier: playerFortune.multiplier,
      })
    }
    let newBossHp = Math.max(0, bossActive.current_hp - playerDamage)
    bossActive.current_hp = newBossHp
    if (newBossHp === 0) bossActive.fainted = true

    // ── Auto-advance boss slot if fainted ────────────────────────────────
    let newBossActiveSlot = fight.boss_active_slot
    let bossSwitchedTo: string | null = null
    if (newBossHp === 0) {
      const nextBossIdx = bossLineup.findIndex((c: any, i: number) => i > fight.boss_active_slot && !c.fainted)
      if (nextBossIdx !== -1) {
        newBossActiveSlot = nextBossIdx
        bossSwitchedTo = bossLineup[nextBossIdx].name
      }
    }

    let allBossFainted = bossLineup.every((c: any) => c.fainted)

    // ── Player→Boss status roll (before counter-attack so paralisi/sonno blocks it) ─
    let statusAppliedToBoss: StatusEffect | null = null
    let bossStatusTurnsLeft = 0
    if (playerDamage > 0 && newBossHp > 0 && !bossActive.fainted) {
      const triggered = rollStatusEffect(playerActive.status_effect as StatusEffect | null, playerActive.status_effect_chance)
      if (triggered) {
        statusAppliedToBoss = triggered
        bossStatusTurnsLeft = STATUS_EFFECT_META[triggered].turns
        bossActive.active_status    = triggered
        bossActive.status_turns_left = bossStatusTurnsLeft
      }
    }

    if (newBossHp > 0 && !bossActive.fainted) {
      const bossStatusTick = resolveTurnStartStatus({
        effect: bossActive.active_status as StatusEffect | null,
        turnsLeft: bossActive.status_turns_left ?? 0,
        currentHp: bossActive.current_hp,
        maxHp: bossActive.max_hp,
        atk: bossActive.atk,
        def: bossActive.def ?? 0,
      })
      bossActive.active_status = bossStatusTick.nextEffect
      bossActive.status_turns_left = bossStatusTick.nextTurnsLeft
      bossActive.current_hp = bossStatusTick.currentHp
      newBossHp = bossStatusTick.currentHp
      if (bossStatusTick.fainted) bossActive.fainted = true
      if (bossStatusTick.event) {
        statusTickEvents.push({ ...bossStatusTick.event, target: 'boss' })
      }
      if (bossStatusTick.preventedAction || bossStatusTick.fainted) skipBossAttack = true
    }

    if (bossActive.fainted && newBossActiveSlot === fight.boss_active_slot) {
      const nextBossIdx = bossLineup.findIndex((c: any, i: number) => i > fight.boss_active_slot && !c.fainted)
      if (nextBossIdx !== -1) {
        newBossActiveSlot = nextBossIdx
        bossSwitchedTo = bossLineup[nextBossIdx].name
      }
    }
    allBossFainted = bossLineup.every((c: any) => c.fainted)

    // ── Boss → Player (only if boss still alive at start of counter-attack) ─
    // The boss that was alive before player's attack counter-attacks
    let bossDamage = 0
    const playerHpBeforeBossAttack = playerActive.current_hp
    let newPlayerHp = playerActive.current_hp
    let bossFortune = null
    let bossCrit = false

    if (!allBossFainted && newBossHp > 0 && !skipBossAttack) {
      const counterBoss = bossActive
      if (counterBoss && !counterBoss.fainted) {
        const bossMult = getElementMultiplier(counterBoss.element as Element, playerActive.element as Element)
        bossFortune = rollCombatFortune({
          attackerLevel: counterBoss.level ?? 1,
          defenderLevel: playerActive.level ?? 1,
          attackerStats: { hp: counterBoss.max_hp, atk: counterBoss.atk, def: counterBoss.def ?? 0 },
          defenderStats: { hp: playerActive.max_hp, atk: playerActive.atk, def: playerActive.def ?? 0 },
        })
        const { isCrit: bossCritRoll, critMultiplier: bossCritMult } = rollCrit()
        bossCrit = bossCritRoll
        bossDamage = calculateCombatDamage({
          attackerAtk: counterBoss.atk,
          defenderDef: playerActive.def ?? 0,
          attackMultiplier: bossCritMult,
          elementMultiplier: bossMult,
          varianceMultiplier: bossFortune.multiplier,
        })
        newPlayerHp = Math.max(0, playerActive.current_hp - bossDamage)
        playerActive.current_hp = newPlayerHp
        if (newPlayerHp === 0) playerActive.fainted = true
      }
    }

    // ── Boss→Player status roll ──────────────────────────────────────────
    let statusAppliedToPlayer: StatusEffect | null = null
    let playerStatusTurnsLeft = 0
    if (bossDamage > 0 && newPlayerHp > 0 && !playerActive.fainted) {
      const bossEffect = bossActive.status_effect as StatusEffect | null
      const bossChance = bossActive.status_effect_chance ?? 0.15
      const triggered = rollStatusEffect(bossEffect, bossChance)
      if (triggered) {
        statusAppliedToPlayer = triggered
        playerStatusTurnsLeft = STATUS_EFFECT_META[triggered].turns
        playerActive.active_status    = triggered
        playerActive.status_turns_left = playerStatusTurnsLeft
      }
    }

    // ── Auto-advance player slot if fainted ─────────────────────────────
    let newPlayerActiveSlot = preTurnPlayerActiveSlot
    let playerSwitchedTo: string | null = preTurnPlayerSwitchedTo
    if (newPlayerHp === 0) {
      playerActive.is_active = false
      const nextPlayerIdx = playerLineup.findIndex((c: any) => !c.fainted)
      if (nextPlayerIdx !== -1) {
        playerLineup[nextPlayerIdx].is_active = true
        newPlayerActiveSlot = nextPlayerIdx
        playerSwitchedTo = playerLineup[nextPlayerIdx].name
      }
    }

    const allPlayerFainted = playerLineup.every((c: any) => c.fainted)

    // ── Determine outcome ────────────────────────────────────────────────
    let newStatus = fight.status
    let won = false

    if (allBossFainted) {
      newStatus = 'won'
      won = true
    } else if (allPlayerFainted) {
      newStatus = 'lost'
    }

    await supabase.from('boss_fights').update({
      boss_lineup:         bossLineup,
      player_lineup:       playerLineup,
      boss_active_slot:    newBossActiveSlot,
      player_active_slot:  newPlayerActiveSlot,
      status:              newStatus,
      ...(newStatus !== 'active' ? { ended_at: new Date().toISOString() } : {}),
    }).eq('id', id)

    // ── Game event on loss ───────────────────────────────────────────────
    if (allPlayerFainted) {
      const bossNameLost = (fight.boss_lineup as any[])?.[0]?.name ?? 'Boss'
      createAdminClient().from('player_game_events').insert({
        user_id: user.id, session_id: fight.session_id, type: 'boss_lost',
        payload: { fight_id: id, boss_name: bossNameLost },
      }).then(undefined, () => {})
    }

    // ── Grant reward on win ──────────────────────────────────────────────
    let levelUp: { newLevel: number; goldReward: number } | null = null
    let enrichedReward: Record<string, unknown> | null = null
    if (won) {
      const rewardResult = await grantBossFightRewards({
        fight,
        fightId: id,
        supabase,
        userId: user.id,
      })
      levelUp = rewardResult.levelUp
      enrichedReward = rewardResult.reward
    }

    return NextResponse.json({
      playerDamage,
      bossDamage,
      playerHpBeforeBossAttack,
      playerFortune,
      bossFortune,
      playerCrit,
      bossCrit,
      playerElementMult: playerMult,
      newBossHp,
      newPlayerHp,
      bossLineup,
      playerLineup,
      bossSwitchedTo,
      playerSwitchedTo,
      status: newStatus,
      won,
      lost: newStatus === 'lost',
      levelUp,
      reward: enrichedReward,
      statusTickEvents,
      preTurnStatusEvent,
      statusAppliedToBoss,
      bossStatusTurnsLeft,
      statusAppliedToPlayer,
      playerStatusTurnsLeft,
    })
  }

  return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
