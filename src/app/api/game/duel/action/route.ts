import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateCombatDamage, calculateConfusionSelfDamage, calculatePoisonDamage, rollCombatFortune, rollConfusionSelfHit, rollCrit, rollParalysisSkip, rollStatusEffect, scaleCombatStats, STATUS_EFFECT_META } from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import { getElementMultiplier } from '@/lib/game/elements'
import { incrementMissionProgress } from '@/lib/game/missions'
import type { CompletedMission } from '@/lib/game/missions'
import type { Element } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { duelId, action, itemId } = await request.json()
  // action: 'attack' | 'heal' | 'surrender' | 'cancel' | 'opponent_timeout'

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

  // ── Cancel (mutual abort — no winner, no awards) ──────────────────────────
  if (action === 'cancel') {
    await supabase
      .from('duels')
      .update({ status: 'ended', winner_id: null, ended_at: new Date().toISOString() })
      .eq('id', duelId)
    const { createAdminClient: adminCancel } = await import('@/lib/supabase/admin')
    const adminC = adminCancel()
    const { data: cancelProfiles } = await adminC.from('profiles').select('user_id, nickname').in('user_id', [user.id, oppUserId!])
    const cancelProfileMap: Record<string, string | null> = Object.fromEntries(
      (cancelProfiles ?? []).map((r: any) => [r.user_id, r.nickname ?? null])
    )
    adminC.from('player_game_events').insert([
      { user_id: user.id,    session_id: duel.session_id, type: 'duel_cancelled', payload: { opponent_id: oppUserId, opponent_name: cancelProfileMap[oppUserId!] ?? null } },
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_cancelled', payload: { opponent_id: user.id,    opponent_name: cancelProfileMap[user.id]    ?? null } },
    ]).then(undefined, () => {})
    return NextResponse.json({ ended: true, winnerId: null, cancelled: true })
  }

  // ── Opponent timeout (caller wins — opponent didn't reconnect in time) ────
  if (action === 'opponent_timeout') {
    await supabase
      .from('duels')
      .update({ status: 'ended', winner_id: user.id, ended_at: new Date().toISOString() })
      .eq('id', duelId)
    await awardDuelResults(supabase, duel.session_id, user.id, oppUserId!)
    incrementMissionProgress({ type: 'duel', userId: user.id, sessionId: duel.session_id }).then(undefined, () => {})
    const { createAdminClient: adminFactory } = await import('@/lib/supabase/admin')
    const adminTimeout = adminFactory()
    const { data: timeoutLineups } = await supabase
      .from('duel_lineups')
      .select('user_id, slot, player_creatures(creatures(name, element, hp, atk, def, image_url, sprite_url, rarity))')
      .eq('duel_id', duelId)
      .order('slot', { ascending: true })
    const { data: timeoutProfiles } = await adminTimeout.from('profiles').select('user_id, nickname').in('user_id', [user.id, oppUserId!])
    const timeoutProfileMap: Record<string, string | null> = Object.fromEntries(
      (timeoutProfiles ?? []).map((r: any) => [r.user_id, r.nickname ?? null])
    )
    const myCreatures  = buildCreatureSummaries(timeoutLineups ?? [], user.id)
    const oppCreatures = buildCreatureSummaries(timeoutLineups ?? [], oppUserId!)
    adminTimeout.from('player_game_events').insert([
      { user_id: user.id,    session_id: duel.session_id, type: 'duel_won',  payload: { opponent_id: oppUserId, opponent_name: timeoutProfileMap[oppUserId!] ?? null, exp: DUEL_WIN_EXP, gold: DUEL_WIN_GOLD, my_creatures: myCreatures, opp_creatures: oppCreatures } },
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_lost', payload: { winner_id: user.id, winner_name: timeoutProfileMap[user.id] ?? null, my_creatures: oppCreatures, opp_creatures: myCreatures } },
    ]).then(undefined, () => {})
    return NextResponse.json({ ended: true, winnerId: user.id })
  }

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
    // Load lineups + profiles for enriched event payload
    const { data: surrenderLineups } = await supabase
      .from('duel_lineups')
      .select('user_id, slot, player_creatures(creatures(name, element, hp, atk, def, image_url, sprite_url, rarity))')
      .eq('duel_id', duelId)
      .order('slot', { ascending: true })
    const { data: surrenderProfiles } = await adminSurrender.from('profiles').select('user_id, nickname').in('user_id', [user.id, oppUserId!])
    const surrenderProfileMap: Record<string, string | null> = Object.fromEntries(
      (surrenderProfiles ?? []).map((r: any) => [r.user_id, r.nickname ?? null])
    )
    const surrenderMine = buildCreatureSummaries(surrenderLineups ?? [], user.id)
    const surrenderOpp  = buildCreatureSummaries(surrenderLineups ?? [], oppUserId!)
    adminSurrender.from('player_game_events').insert([
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_won',  payload: { opponent_id: user.id, opponent_name: surrenderProfileMap[user.id] ?? null, exp: DUEL_WIN_EXP, gold: DUEL_WIN_GOLD, my_creatures: surrenderOpp, opp_creatures: surrenderMine } },
      { user_id: user.id,    session_id: duel.session_id, type: 'duel_lost', payload: { winner_id: oppUserId, winner_name: surrenderProfileMap[oppUserId!] ?? null, my_creatures: surrenderMine, opp_creatures: surrenderOpp } },
    ]).then(undefined, () => {})
    return NextResponse.json({ ended: true, winnerId: oppUserId })
  }

  // ── Heal ───────────────────────────────────────────────────────────────────
  if (action === 'heal') {
    if (duel.current_turn !== myRole) {
      return NextResponse.json({ error: 'Non è il tuo turno' }, { status: 409 })
    }
    if (!itemId) return NextResponse.json({ error: 'itemId richiesto' }, { status: 400 })

    const { data: invItem } = await supabase
      .from('player_inventory')
      .select('id, quantity, items(effect_value, type)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .eq('session_id', duel.session_id)
      .single()

    const inv = invItem as { id: string; quantity: number; items: { effect_value: number; type: string } } | null
    if (!inv || inv.quantity <= 0 || inv.items?.type !== 'cura') {
      return NextResponse.json({ error: 'Oggetto non valido' }, { status: 400 })
    }

    // Load my active creature
    const { data: healLineups } = await supabase
      .from('duel_lineups')
      .select('id, current_hp, player_creatures(creatures(hp, atk, def))')
      .eq('duel_id', duelId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!healLineups) return NextResponse.json({ error: 'Nessuna creatura attiva' }, { status: 400 })

    const { data: healPsRow } = await supabase
      .from('player_sessions')
      .select('level')
      .eq('user_id', user.id)
      .eq('session_id', duel.session_id)
      .maybeSingle()
    const healLevel = healPsRow?.level ?? 1
    const baseCreature = (healLineups as any).player_creatures?.creatures
    const maxHp = scaleCombatStats(
      { hp: baseCreature?.hp ?? 100, atk: baseCreature?.atk ?? 10, def: baseCreature?.def ?? 0 },
      healLevel,
    ).hp

    const healAmount = Math.round(maxHp * ((inv.items.effect_value ?? 20) / 100))
    const newHp = Math.min(maxHp, (healLineups as any).current_hp + healAmount)

    await Promise.all([
      supabase.from('duel_lineups').update({ current_hp: newHp }).eq('id', (healLineups as any).id),
      supabase.from('player_inventory').update({ quantity: inv.quantity - 1 }).eq('id', itemId),
      supabase.from('duels').update({ current_turn: isChallenger ? 'opponent' : 'challenger' }).eq('id', duelId),
    ])

    const nextTurn: 'challenger' | 'opponent' = isChallenger ? 'opponent' : 'challenger'
    const channel = supabase.channel(`duel:${duelId}`)
    await new Promise<void>(resolve => channel.subscribe(() => resolve()))
    await channel.send({
      type: 'broadcast',
      event: 'duel_action',
      payload: { actorId: user.id, action: 'heal', healAmount, newHp, nextTurn, duelOver: false },
    })
    await supabase.removeChannel(channel)

    return NextResponse.json({ healed: true, healAmount, newHp, nextTurn })
  }

  // ── Turn check ─────────────────────────────────────────────────────────────
  if (duel.current_turn !== myRole) {
    return NextResponse.json({ error: 'Non è il tuo turno' }, { status: 409 })
  }

  // ── Load all lineups ───────────────────────────────────────────────────────
  const { data: allLineups } = await supabase
    .from('duel_lineups')
    .select('*, player_creatures(*, creatures(name, element, hp, atk, def, image_url, sprite_url, rarity, status_effect, status_effect_chance))')
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

  // ── Status effect pre-turn processing ─────────────────────────────────────
  const attackerStatus    = (myActive as any).active_status as StatusEffect | null
  const attackerTurnsLeft = (myActive as any).status_turns_left ?? 0
  const nextTurnRole: 'challenger' | 'opponent' = isChallenger ? 'opponent' : 'challenger'
  const currentUserId = user.id
  const duelLineups = allLineups ?? []

  // Helper: end duel when the attacker faints from a status effect
  async function endDuelFromStatusFaint() {
    const allMyFainted = duelLineups
      .filter((l: any) => l.user_id === currentUserId)
      .every((l: any) => l.id === myActive.id || l.fainted_at !== null)
    if (allMyFainted) {
      await supabase.from('duels').update({ status: 'ended', winner_id: oppUserId, ended_at: new Date().toISOString() }).eq('id', duelId)
      await awardDuelResults(supabase, duel.session_id, oppUserId!, currentUserId)
      incrementMissionProgress({ type: 'duel', userId: oppUserId!, sessionId: duel.session_id }).then(undefined, () => {})
    }
    return allMyFainted
  }

  async function switchToNextMyCreature() {
    const myRemaining = duelLineups
      .filter((l: any) => l.user_id === currentUserId && !l.fainted_at && l.id !== myActive.id)
      .sort((a: any, b: any) => a.slot - b.slot)
    const nextMine = myRemaining[0]
    if (!nextMine) return null

    await supabase.from('duel_lineups').update({ is_active: true }).eq('id', nextMine.id)
    const myField = isChallenger ? 'challenger_creature_id' : 'opponent_creature_id'
    await supabase.from('duels').update({ [myField]: nextMine.player_creature_id }).eq('id', duelId)

    return {
      userId: currentUserId,
      slot: nextMine.slot,
      playerCreatureId: nextMine.player_creature_id,
      name: (nextMine as any).player_creatures?.creatures?.name ?? 'Creatura',
    }
  }

  // ── Sonno: always skip turn ───────────────────────────────────────────────
  if (attackerStatus === 'veleno') {
    const poisonDmg = calculatePoisonDamage(myCombatStats.hp)
    const poisonHp = Math.max(0, myActive.current_hp - poisonDmg)
    await supabase.from('duel_lineups').update({
      current_hp: poisonHp,
      ...(poisonHp === 0 ? { fainted_at: new Date().toISOString(), is_active: false } : {}),
    }).eq('id', myActive.id)

    let duelEndedNow = false
    let statusSwitchedTo: { userId: string; slot: number; playerCreatureId: string; name: string } | null = null
    if (poisonHp === 0) {
      duelEndedNow = await endDuelFromStatusFaint()
      if (!duelEndedNow) statusSwitchedTo = await switchToNextMyCreature()
    }
    if (!duelEndedNow) {
      await supabase.from('duels').update({ current_turn: nextTurnRole }).eq('id', duelId)
    }

    const ch = supabase.channel(`duel:${duelId}`)
    await new Promise<void>(r => ch.subscribe(() => r()))
    await ch.send({ type: 'broadcast', event: 'duel_action', payload: {
      actorId: user.id,
      action: 'status_tick',
      statusEvent: { type: 'veleno', poisonDamage: poisonDmg, newMyHp: poisonHp, fainted: poisonHp === 0 },
      nextTurn: duelEndedNow ? null : nextTurnRole,
      duelOver: duelEndedNow,
      winnerId: duelEndedNow ? oppUserId : null,
      statusSwitchedTo,
    }})
    await supabase.removeChannel(ch)

    return NextResponse.json({ turnPassed: true, statusEffect: 'veleno', poisonDamage: poisonDmg, duelOver: duelEndedNow })
  }

  if (attackerStatus === 'sonno') {
    const newTurns = attackerTurnsLeft - 1
    const cleared  = newTurns <= 0
    await supabase.from('duel_lineups').update({
      active_status: cleared ? null : 'sonno',
      status_turns_left: Math.max(0, newTurns),
    }).eq('id', myActive.id)
    await supabase.from('duels').update({ current_turn: nextTurnRole }).eq('id', duelId)

    const ch = supabase.channel(`duel:${duelId}`)
    await new Promise<void>(r => ch.subscribe(() => r()))
    await ch.send({ type: 'broadcast', event: 'duel_action', payload: {
      actorId: user.id, action: 'status_tick',
      statusEvent: { type: 'sonno', turnPassed: true, cleared, turnsLeft: Math.max(0, newTurns) },
      nextTurn: nextTurnRole, duelOver: false,
    }})
    await supabase.removeChannel(ch)
    return NextResponse.json({ turnPassed: true, statusEffect: 'sonno', cleared })
  }

  // ── Confusione: 50/50 self-hit or normal attack ───────────────────────────
  let preTurnStatusEvent: Record<string, unknown> | null = null

  // ── Paralisi: 65% skip turn, 35% attack proceeds ─────────────────────────
  if (attackerStatus === 'paralisi') {
    const newTurns = attackerTurnsLeft - 1
    const cleared  = newTurns <= 0
    await supabase.from('duel_lineups').update({
      active_status: cleared ? null : 'paralisi',
      status_turns_left: Math.max(0, newTurns),
    }).eq('id', myActive.id)

    if (rollParalysisSkip()) {
      await supabase.from('duels').update({ current_turn: nextTurnRole }).eq('id', duelId)
      const ch = supabase.channel(`duel:${duelId}`)
      await new Promise<void>(r => ch.subscribe(() => r()))
      await ch.send({ type: 'broadcast', event: 'duel_action', payload: {
        actorId: user.id, action: 'status_tick',
        statusEvent: { type: 'paralisi', paralysisSkip: true, cleared, turnsLeft: Math.max(0, newTurns) },
        nextTurn: nextTurnRole, duelOver: false,
      }})
      await supabase.removeChannel(ch)
      return NextResponse.json({ turnPassed: true, statusEffect: 'paralisi', cleared })
    }
    // 35%: attack proceeds — record the tick for broadcast
    preTurnStatusEvent = { type: 'paralisi', paralysisSkip: false, cleared, turnsLeft: Math.max(0, newTurns) }
  }
  if (attackerStatus === 'confusione') {
    const newTurns = attackerTurnsLeft - 1
    const cleared  = newTurns <= 0
    await supabase.from('duel_lineups').update({
      active_status: cleared ? null : 'confusione',
      status_turns_left: Math.max(0, newTurns),
    }).eq('id', myActive.id)

    if (rollConfusionSelfHit()) {
      // Self-hit
      const selfDmg  = calculateConfusionSelfDamage(myCombatStats.atk, myCombatStats.def)
      const selfHp   = Math.max(0, myActive.current_hp - selfDmg)
      await supabase.from('duel_lineups').update({
        current_hp: selfHp,
        ...(selfHp === 0 ? { fainted_at: new Date().toISOString(), is_active: false } : {}),
      }).eq('id', myActive.id)

      let duelEndedNow = false
      let statusSwitchedTo: { userId: string; slot: number; playerCreatureId: string; name: string } | null = null
      if (selfHp === 0) {
        duelEndedNow = await endDuelFromStatusFaint()
        if (!duelEndedNow) statusSwitchedTo = await switchToNextMyCreature()
      }
      if (!duelEndedNow) await supabase.from('duels').update({ current_turn: nextTurnRole }).eq('id', duelId)

      const ch = supabase.channel(`duel:${duelId}`)
      await new Promise<void>(r => ch.subscribe(() => r()))
      await ch.send({ type: 'broadcast', event: 'duel_action', payload: {
        actorId: user.id, action: 'status_tick',
        statusEvent: { type: 'confusione', selfHit: true, selfDamage: selfDmg, selfHp, cleared, turnsLeft: Math.max(0, newTurns), fainted: selfHp === 0 },
        nextTurn: duelEndedNow ? null : nextTurnRole,
        duelOver: duelEndedNow, winnerId: duelEndedNow ? oppUserId : null,
        newMyHp: selfHp, statusSwitchedTo,
      }})
      await supabase.removeChannel(ch)
      return NextResponse.json({ confusionSelfHit: true, selfDamage: selfDmg, duelOver: duelEndedNow })
    }
    // Normal attack this turn — record the confusion decrement for broadcast
    preTurnStatusEvent = { type: 'confusione', selfHit: false, cleared, turnsLeft: Math.max(0, newTurns) }
  }

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
  const { isCrit, critMultiplier } = rollCrit()
  const damage = calculateCombatDamage({
    attackerAtk: myCombatStats.atk,
    defenderDef: oppCombatStats.def,
    attackMultiplier: atkMultiplier * critMultiplier,
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

  // ── Roll post-attack status effect on opponent ─────────────────────────────
  let statusAppliedToOpp: StatusEffect | null = null
  let oppStatusTurnsLeft = 0
  if (!duelOver && newOppHp > 0) {
    const triggered = rollStatusEffect(myCreature.status_effect as StatusEffect | null, myCreature.status_effect_chance)
    if (triggered) {
      statusAppliedToOpp = triggered
      oppStatusTurnsLeft = STATUS_EFFECT_META[triggered].turns
      await supabase.from('duel_lineups').update({
        active_status: triggered,
        status_turns_left: oppStatusTurnsLeft,
      }).eq('id', oppActive.id)
    }
  }

  // Flip turn to opponent (status is already written above, before this update)
  if (!duelOver) {
    await supabase.from('duels').update({ current_turn: nextTurn }).eq('id', duelId)
  }

  // ── Post-attack veleno tick (attacker takes poison damage after attacking) ─
  let poisonEvent: { damage: number; newHp: number; fainted: boolean; switchedTo?: { userId: string; slot: number; playerCreatureId: string; name: string } | null } | null = null
  let velenoDuelOver = false
  let applyLegacyPostAttackPoison = false
  if (applyLegacyPostAttackPoison && !duelOver) {
    const poisonDmg = calculatePoisonDamage(myCombatStats.hp)
    const poisonHp  = Math.max(0, myActive.current_hp - poisonDmg)
    await supabase.from('duel_lineups').update({
      current_hp: poisonHp,
      ...(poisonHp === 0 ? { fainted_at: new Date().toISOString(), is_active: false } : {}),
    }).eq('id', myActive.id)

    poisonEvent = { damage: poisonDmg, newHp: poisonHp, fainted: poisonHp === 0 }

    if (poisonHp === 0) {
      velenoDuelOver = await endDuelFromStatusFaint()
      if (!velenoDuelOver) {
        const myRemaining = (allLineups ?? [])
          .filter((l: any) => l.user_id === user.id && !l.fainted_at && l.id !== myActive.id)
          .sort((a: any, b: any) => a.slot - b.slot)
        const nextMine = myRemaining[0]
        if (nextMine) {
          await supabase.from('duel_lineups').update({ is_active: true }).eq('id', nextMine.id)
          const myField = isChallenger ? 'challenger_creature_id' : 'opponent_creature_id'
          await supabase.from('duels').update({ [myField]: nextMine.player_creature_id }).eq('id', duelId)
          poisonEvent.switchedTo = { userId: user.id, slot: nextMine.slot, playerCreatureId: nextMine.player_creature_id, name: (nextMine as any).player_creatures?.creatures?.name ?? 'Creatura' }
        }
      }
    }
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
    // Build creature summaries from allLineups for event payload
    const myCreatures   = buildCreatureSummaries(allLineups ?? [], user.id)
    const oppCreatures  = buildCreatureSummaries(allLineups ?? [], oppUserId!)
    // Fetch opponent nickname
    const { data: profileRows } = await adminClient.from('profiles').select('user_id, nickname').in('user_id', [user.id, oppUserId!])
    const profileMap: Record<string, string | null> = Object.fromEntries(
      (profileRows ?? []).map((r: any) => [r.user_id, r.nickname ?? null])
    )
    const eventsToInsert = [
      { user_id: user.id,    session_id: duel.session_id, type: 'duel_won',  payload: { opponent_id: oppUserId, opponent_name: profileMap[oppUserId!] ?? null, exp: DUEL_WIN_EXP, gold: DUEL_WIN_GOLD, my_creatures: myCreatures, opp_creatures: oppCreatures } },
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_lost', payload: { winner_id: user.id, winner_name: profileMap[user.id] ?? null, my_creatures: oppCreatures, opp_creatures: myCreatures } },
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
      isCrit,
      elementMultiplier: mult,
      itemUsed: atkMultiplier > 1,
      nextTurn: (duelOver || velenoDuelOver) ? null : nextTurn,
      newOppHp,
      switchedTo,
      duelOver: duelOver || velenoDuelOver,
      winnerId: winnerId ?? (velenoDuelOver ? (oppUserId ?? null) : null),
      preTurnStatusEvent: preTurnStatusEvent ?? null,
      statusAppliedToOpp,
      oppStatusTurnsLeft,
      poisonEvent,
    },
  })
  await supabase.removeChannel(channel)

  return NextResponse.json({
    damage,
    fortune,
    isCrit,
    elementMultiplier: mult,
    nextTurn: duelOver ? null : nextTurn,
    duelOver,
    switchedTo,
    levelUp: myLevelUp,
    completedMissions,
  })
}

const DUEL_WIN_EXP  = 30
const DUEL_WIN_GOLD = 30  // mirrors EXP

function buildCreatureSummaries(lineups: any[], userId: string) {
  return lineups
    .filter(l => l.user_id === userId)
    .sort((a, b) => a.slot - b.slot)
    .map(l => {
      const cr = l.player_creatures?.creatures
      if (!cr) return null
      return {
        name:      cr.name      ?? null,
        image_url: cr.image_url ?? cr.sprite_url ?? null,
        rarity:    cr.rarity    ?? null,
        element:   cr.element   ?? null,
        hp:        cr.hp        ?? null,
        atk:       cr.atk       ?? null,
        def:       cr.def       ?? null,
      }
    })
    .filter(Boolean)
}

async function awardDuelResults(
  supabase: any,
  sessionId: string,
  winnerId: string,
  _loserId: string,
): Promise<{ winnerLevelUp: { newLevel: number; goldReward: number } | null }> {
  // Winner gets EXP + score + gold atomically via the RPC (p_gold added in migration 015).
  // Loser gets nothing (REQ-XP-03) — no separate call needed.
  const { data } = await supabase.rpc('increment_player_stats', {
    p_user_id:    winnerId,
    p_session_id: sessionId,
    p_exp:        DUEL_WIN_EXP,
    p_score:      20,
    p_gold:       DUEL_WIN_GOLD,
  })

  const winRow = Array.isArray(data) ? data[0] : null
  return {
    winnerLevelUp: winRow?.leveled_up
      ? { newLevel: winRow.new_level, goldReward: winRow.gold_reward ?? 0 }
      : null,
  }
}
