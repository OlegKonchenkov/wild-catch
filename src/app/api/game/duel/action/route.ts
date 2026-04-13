import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateCombatDamage, rollCombatFortune, scaleCombatStats } from '@/lib/game/combat'
import { getElementMultiplier } from '@/lib/game/elements'
import { incrementMissionProgress } from '@/lib/game/missions'
import type { CompletedMission } from '@/lib/game/missions'
import type { Element } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { duelId, action, itemId } = await request.json()
  // action: 'attack' | 'surrender'

  const { data: duel } = await supabase
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .eq('status', 'active')
    .single()

  if (!duel) return NextResponse.json({ error: 'Duello non trovato' }, { status: 404 })

  // Guard: session must still be active
  const { data: sessionCheck } = await supabase.from('sessions').select('status').eq('id', duel.session_id).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    const notStarted = sessionCheck?.status === 'draft' || sessionCheck?.status === 'ready'
    const errMsg = notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
    return NextResponse.json({ error: errMsg }, { status: 403 })
  }

  const isChallenger = duel.challenger_id === user.id
  const isOpponent   = duel.opponent_id   === user.id
  if (!isChallenger && !isOpponent) return NextResponse.json({ error: 'Non sei in questo duello' }, { status: 403 })

  const myRole: 'challenger' | 'opponent' = isChallenger ? 'challenger' : 'opponent'
  const oppUserId = isChallenger ? duel.opponent_id : duel.challenger_id

  // ── Surrender ──────────────────────────────────────────────────────────────
  if (action === 'surrender') {
    await supabase
      .from('duels')
      .update({ status: 'ended', winner_id: oppUserId, ended_at: new Date().toISOString() })
      .eq('id', duelId)
    await awardDuelResults(supabase, duel.session_id, oppUserId!, user.id)
    incrementMissionProgress({ type: 'duel', userId: oppUserId!, sessionId: duel.session_id }).then(undefined, () => {})
    // Game events on surrender
    const { createAdminClient: adminClientFactory } = await import('@/lib/supabase/admin')
    const adminSurrender = adminClientFactory()
    adminSurrender.from('player_game_events').insert([
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_won',  payload: { opponent_id: user.id } },
      { user_id: user.id,    session_id: duel.session_id, type: 'duel_lost', payload: { winner_id: oppUserId } },
    ]).then(undefined, () => {})
    return NextResponse.json({ ended: true, winnerId: oppUserId })
  }

  // ── Turn check ─────────────────────────────────────────────────────────────
  if (duel.current_turn !== myRole) {
    return NextResponse.json({ error: 'Non è il tuo turno' }, { status: 409 })
  }

  // ── Load all lineups ───────────────────────────────────────────────────────
  const { data: allLineups } = await supabase
    .from('duel_lineups')
    .select('*, player_creatures(*, creatures(name, element, hp, atk, def))')
    .eq('duel_id', duelId)
    .order('slot', { ascending: true })

  if (!allLineups || allLineups.length < 2) {
    return NextResponse.json({ error: 'Lineup non trovato' }, { status: 500 })
  }

  const myActive  = allLineups.find(l => l.user_id === user.id    && l.is_active)
  const oppActive = allLineups.find(l => l.user_id === oppUserId  && l.is_active)

  if (!myActive || !oppActive) {
    return NextResponse.json({ error: 'Creature attive non trovate' }, { status: 500 })
  }

  const myCreature  = (myActive  as any).player_creatures?.creatures
  const oppCreature = (oppActive as any).player_creatures?.creatures

  if (!myCreature || !oppCreature) {
    return NextResponse.json({ error: 'Dati creature non disponibili' }, { status: 500 })
  }

  const duelUserIds = [user.id, oppUserId].filter(Boolean)
  const { data: playerSessions } = await supabase
    .from('player_sessions')
    .select('user_id, level')
    .eq('session_id', duel.session_id)
    .in('user_id', duelUserIds)

  const levelByUser = Object.fromEntries(
    (playerSessions ?? []).map((row: { user_id: string; level: number | null }) => [row.user_id, row.level ?? 1]),
  ) as Record<string, number>
  const myCombatStats = scaleCombatStats(
    { hp: myCreature.hp, atk: myCreature.atk, def: myCreature.def ?? 0 },
    levelByUser[user.id],
  )
  const oppCombatStats = scaleCombatStats(
    { hp: oppCreature.hp, atk: oppCreature.atk, def: oppCreature.def ?? 0 },
    levelByUser[oppUserId!] ?? 1,
  )

  // ── Optional battaglia item ────────────────────────────────────────────────
  let atkMultiplier = 1
  if (itemId) {
    const { data: invItem } = await supabase
      .from('player_inventory')
      .select('quantity, items(effect_value, type)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .eq('session_id', duel.session_id)
      .single()

    const inv = invItem as { quantity: number; items: { effect_value: number; type: string } } | null
    if (inv && inv.quantity > 0 && inv.items?.type === 'battaglia') {
      atkMultiplier = 1 + (inv.items.effect_value ?? 0) / 100
      await supabase
        .from('player_inventory')
        .update({ quantity: inv.quantity - 1 })
        .eq('id', itemId)
    }
  }

  // ── Damage calculation ─────────────────────────────────────────────────────
  const mult   = getElementMultiplier(myCreature.element as Element, oppCreature.element as Element)
  const fortune = rollCombatFortune({
    attackerLevel: levelByUser[user.id],
    defenderLevel: levelByUser[oppUserId!] ?? 1,
    attackerStats: myCombatStats,
    defenderStats: oppCombatStats,
  })
  const damage = calculateCombatDamage({
    attackerAtk: myCombatStats.atk,
    defenderDef: oppCombatStats.def,
    attackMultiplier: atkMultiplier,
    elementMultiplier: mult,
    varianceMultiplier: fortune.multiplier,
  })
  const newOppHp = Math.max(0, oppActive.current_hp - damage)

  // Update opponent active creature HP (+ mark fainted if dead)
  await supabase
    .from('duel_lineups')
    .update({
      current_hp: newOppHp,
      ...(newOppHp === 0 ? { fainted_at: new Date().toISOString(), is_active: false } : {}),
    })
    .eq('id', oppActive.id)

  // ── Handle faint & auto-switch ────────────────────────────────────────────
  let switchedTo: { userId: string; slot: number; playerCreatureId: string; name: string } | null = null
  let duelOver = false
  let winnerId: string | null = null

  if (newOppHp === 0) {
    // Remaining opponent creatures (not yet fainted, excluding the one we just killed)
    const oppRemaining = allLineups
      .filter(l => l.user_id === oppUserId && !l.fainted_at && l.id !== oppActive.id)
      .sort((a, b) => a.slot - b.slot)

    if (oppRemaining.length === 0) {
      // All fainted — we win
      duelOver = true
      winnerId = user.id
      await supabase
        .from('duels')
        .update({ status: 'ended', winner_id: user.id, ended_at: new Date().toISOString() })
        .eq('id', duelId)
    } else {
      // Switch to next creature
      const next = oppRemaining[0]
      await supabase.from('duel_lineups').update({ is_active: true }).eq('id', next.id)

      // Update duel's active creature ref for the opponent
      const oppCreatureField = isChallenger ? 'opponent_creature_id' : 'challenger_creature_id'
      await supabase
        .from('duels')
        .update({ [oppCreatureField]: next.player_creature_id })
        .eq('id', duelId)

      const nextName = (next as any).player_creatures?.creatures?.name ?? 'Creatura'
      switchedTo = {
        userId: oppUserId!,
        slot: next.slot,
        playerCreatureId: next.player_creature_id,
        name: nextName,
      }
    }
  }

  const nextTurn: 'challenger' | 'opponent' = isChallenger ? 'opponent' : 'challenger'
  if (!duelOver) {
    await supabase.from('duels').update({ current_turn: nextTurn }).eq('id', duelId)
  }

  // ── Awards ─────────────────────────────────────────────────────────────────
  let myLevelUp: { newLevel: number; goldReward: number } | null = null
  let completedMissions: CompletedMission[] = []
  if (duelOver) {
    const [levelUps, missions] = await Promise.all([
      awardDuelResults(supabase, duel.session_id, user.id, oppUserId!),
      incrementMissionProgress({ type: 'duel', userId: user.id, sessionId: duel.session_id }).catch(() => [] as CompletedMission[]),
    ])
    myLevelUp = levelUps.winnerLevelUp
    completedMissions = missions
    // Save game events for bell history
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = createAdminClient()
    const eventsToInsert = [
      { user_id: user.id,    session_id: duel.session_id, type: 'duel_won',  payload: { opponent_id: oppUserId } },
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_lost', payload: { winner_id: user.id } },
    ]
    adminClient.from('player_game_events').insert(eventsToInsert).then(undefined, () => {})
    if (myLevelUp) {
      adminClient.from('player_game_events').insert({
        user_id: user.id,
        session_id: duel.session_id,
        type: 'level_up',
        payload: { new_level: myLevelUp.newLevel, gold_reward: myLevelUp.goldReward },
      }).then(undefined, () => {})
    }
  }

  // ── Broadcast ──────────────────────────────────────────────────────────────
  const channel = supabase.channel(`duel:${duelId}`)
  await new Promise<void>(resolve => channel.subscribe(() => resolve()))
  await channel.send({
    type: 'broadcast',
    event: 'duel_action',
    payload: {
      actorId: user.id,
      action,
      damage,
      fortune,
      elementMultiplier: mult,
      itemUsed: atkMultiplier > 1,
      nextTurn: duelOver ? null : nextTurn,
      newOppHp,
      switchedTo,
      duelOver,
      winnerId,
    },
  })
  await supabase.removeChannel(channel)

  return NextResponse.json({
    damage,
    fortune,
    elementMultiplier: mult,
    nextTurn: duelOver ? null : nextTurn,
    duelOver,
    switchedTo,
    levelUp: myLevelUp,
    completedMissions,
  })
}

async function awardDuelResults(
  supabase: any,
  sessionId: string,
  winnerId: string,
  loserId: string,
): Promise<{ winnerLevelUp: { newLevel: number; goldReward: number } | null }> {
  // REQ-XP-03: chi perde = 0 XP. Chi vince ottiene XP + score
  const [winResult] = await Promise.all([
    supabase.rpc('increment_player_stats', { p_user_id: winnerId, p_session_id: sessionId, p_exp: 30, p_score: 20 }),
    supabase.rpc('increment_player_stats', { p_user_id: loserId,  p_session_id: sessionId, p_exp: 0,  p_score: 0  }),
  ])
  const winRow = Array.isArray(winResult.data) ? winResult.data[0] : null
  return {
    winnerLevelUp: winRow?.leveled_up
      ? { newLevel: winRow.new_level, goldReward: winRow.gold_reward ?? 0 }
      : null,
  }
}
