import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { calculateCombatDamage, resolveTurnStartStatus, rollCombatFortune, rollCrit, rollStatusEffect, scaleCombatStats, STATUS_EFFECT_META } from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import { getElementMultiplier } from '@/lib/game/elements'
import { getEquipmentBonuses } from '@/lib/game/equipment'
import {
  resolveAbilityCast, tickAbilityState, applyStatMods, addSelfBuffs, addEnemyDebuffs,
  normalizeAbilityState, isAbilityUsable, type Ability, type AbilityBattleState,
} from '@/lib/game/abilities'
import type { Json } from '@/types/database'
import { sendPushToUser, pickOne } from '@/lib/push'
import { incrementMissionProgress } from '@/lib/game/missions'
import type { CompletedMission } from '@/lib/game/missions'
import type { Element } from '@/lib/types'

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const userId = user.id

  const { duelId, action, itemId, targetLineupId, abilityId } = await request.json()
  // action: 'attack' | 'heal' | 'switch' | 'surrender' | 'cancel' | 'opponent_timeout'
  // 'attack' may carry an optional abilityId to cast a learned special ability.

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

  const isChallenger = duel.challenger_id === userId
  const isOpponent   = duel.opponent_id   === userId
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
    const { data: cancelProfiles } = await adminC.from('profiles').select('user_id, nickname').in('user_id', [userId, oppUserId!])
    const cancelProfileMap: Record<string, string | null> = Object.fromEntries(
      (cancelProfiles ?? []).map((r: any) => [r.user_id, r.nickname ?? null])
    )
    adminC.from('player_game_events').insert([
      { user_id: userId,     session_id: duel.session_id, type: 'duel_cancelled', payload: { opponent_id: oppUserId, opponent_name: cancelProfileMap[oppUserId!] ?? null } },
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_cancelled', payload: { opponent_id: userId,    opponent_name: cancelProfileMap[userId]    ?? null } },
    ]).then(undefined, () => {})
    return NextResponse.json({ ended: true, winnerId: null, cancelled: true })
  }

  // ── Opponent timeout (caller wins — opponent didn't reconnect in time) ────
  if (action === 'opponent_timeout') {
    await supabase
      .from('duels')
      .update({ status: 'ended', winner_id: userId, ended_at: new Date().toISOString() })
      .eq('id', duelId)
    await awardDuelResults(supabase, duel.session_id, userId, oppUserId!)
    incrementMissionProgress({ type: 'duel', userId, sessionId: duel.session_id }).then(undefined, () => {})
    const { createAdminClient: adminFactory } = await import('@/lib/supabase/admin')
    const adminTimeout = adminFactory()
    const { data: timeoutLineups } = await supabase
      .from('duel_lineups')
      .select('user_id, slot, player_creatures(creatures(name, element, hp, atk, def, image_url, sprite_cutout_url, sprite_url, rarity))')
      .eq('duel_id', duelId)
      .order('slot', { ascending: true })
    const { data: timeoutProfiles } = await adminTimeout.from('profiles').select('user_id, nickname').in('user_id', [userId, oppUserId!])
    const timeoutProfileMap: Record<string, string | null> = Object.fromEntries(
      (timeoutProfiles ?? []).map((r: any) => [r.user_id, r.nickname ?? null])
    )
    const myCreatures  = buildCreatureSummaries(timeoutLineups ?? [], userId)
    const oppCreatures = buildCreatureSummaries(timeoutLineups ?? [], oppUserId!)
    adminTimeout.from('player_game_events').insert([
      { user_id: userId,     session_id: duel.session_id, type: 'duel_won',  payload: { opponent_id: oppUserId, opponent_name: timeoutProfileMap[oppUserId!] ?? null, exp: DUEL_WIN_EXP, gold: DUEL_WIN_GOLD, my_creatures: myCreatures, opp_creatures: oppCreatures } },
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_lost', payload: { winner_id: userId, winner_name: timeoutProfileMap[userId] ?? null, my_creatures: oppCreatures, opp_creatures: myCreatures } },
    ]).then(undefined, () => {})
    {
      const winnerName = timeoutProfileMap[userId] ?? 'L\'avversario'
      const loserName = timeoutProfileMap[oppUserId!] ?? null
      after(() => sendPushToUser(oppUserId!, {
        title: '⏱️ Duello perso',
        body: pickOne([
          `Tempo scaduto: ${winnerName} si aggiudica il duello. Rivincita?`,
          `Non sei rientrato in tempo — ${winnerName} vince. La prossima è tua!`,
        ]),
        url: '/game/duel', tag: 'duel_result',
      }))
      after(() => sendPushToUser(userId, {
        title: '🏆 Duello vinto!',
        body: pickOne([
          `${loserName ?? 'L\'avversario'} non è tornato in tempo: vittoria a tavolino!`,
          `Vittoria! ${loserName ?? 'Lo sfidante'} ha lasciato il campo.`,
        ]),
        url: '/game/duel', tag: 'duel_result',
      }))
    }
    return NextResponse.json({ ended: true, winnerId: userId })
  }

  // ── Surrender ──────────────────────────────────────────────────────────────
  if (action === 'surrender') {
    await supabase
      .from('duels')
      .update({ status: 'ended', winner_id: oppUserId, ended_at: new Date().toISOString() })
      .eq('id', duelId)
    await awardDuelResults(supabase, duel.session_id, oppUserId!, userId)
    incrementMissionProgress({ type: 'duel', userId: oppUserId!, sessionId: duel.session_id }).then(undefined, () => {})
    // Game events on surrender
    const { createAdminClient: adminClientFactory } = await import('@/lib/supabase/admin')
    const adminSurrender = adminClientFactory()
    // Load lineups + profiles for enriched event payload
    const { data: surrenderLineups } = await supabase
      .from('duel_lineups')
      .select('user_id, slot, player_creatures(creatures(name, element, hp, atk, def, image_url, sprite_cutout_url, sprite_url, rarity))')
      .eq('duel_id', duelId)
      .order('slot', { ascending: true })
    const { data: surrenderProfiles } = await adminSurrender.from('profiles').select('user_id, nickname').in('user_id', [userId, oppUserId!])
    const surrenderProfileMap: Record<string, string | null> = Object.fromEntries(
      (surrenderProfiles ?? []).map((r: any) => [r.user_id, r.nickname ?? null])
    )
    const surrenderMine = buildCreatureSummaries(surrenderLineups ?? [], userId)
    const surrenderOpp  = buildCreatureSummaries(surrenderLineups ?? [], oppUserId!)
    adminSurrender.from('player_game_events').insert([
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_won',  payload: { opponent_id: userId, opponent_name: surrenderProfileMap[userId] ?? null, exp: DUEL_WIN_EXP, gold: DUEL_WIN_GOLD, my_creatures: surrenderOpp, opp_creatures: surrenderMine } },
      { user_id: userId,     session_id: duel.session_id, type: 'duel_lost', payload: { winner_id: oppUserId, winner_name: surrenderProfileMap[oppUserId!] ?? null, my_creatures: surrenderMine, opp_creatures: surrenderOpp } },
    ]).then(undefined, () => {})
    {
      const loserName = surrenderProfileMap[userId] ?? 'L\'avversario'
      after(() => sendPushToUser(oppUserId!, {
        title: '🏆 Duello vinto!',
        body: pickOne([
          `${loserName} si è arreso: la vittoria è tua!`,
          `${loserName} ha gettato la spugna. Ben giocato!`,
        ]),
        url: '/game/duel', tag: 'duel_result',
      }))
    }
    return NextResponse.json({ ended: true, winnerId: oppUserId })
  }

  // ── Switch active creature (replaces this turn's attack) ─────────────────
  // Player swaps their active creature for a non-fainted teammate. Status on
  // both creatures is preserved on their respective lineup rows. Turn flips
  // to the opponent (no auto-attack — the opponent plays their own turn next).
  if (action === 'switch') {
    if (duel.current_turn !== myRole) {
      return NextResponse.json({ error: 'Non è il tuo turno' }, { status: 409 })
    }
    if (!targetLineupId) {
      return NextResponse.json({ error: 'targetLineupId richiesto' }, { status: 400 })
    }

    const { data: switchLineups } = await supabase
      .from('duel_lineups')
      .select('*, player_creatures(*, creatures(name, element, hp, atk, def, image_url, sprite_cutout_url, sprite_url, rarity))')
      .eq('duel_id', duelId)
      .order('slot', { ascending: true })

    if (!switchLineups || switchLineups.length < 2) {
      return NextResponse.json({ error: 'Lineup non trovato' }, { status: 500 })
    }

    const myCurrentActive = switchLineups.find((l: any) => l.user_id === userId && l.is_active)
    const targetLineup    = switchLineups.find((l: any) => l.id === targetLineupId && l.user_id === userId)

    if (!targetLineup) return NextResponse.json({ error: 'Creatura non valida' }, { status: 404 })
    if (targetLineup.is_active) return NextResponse.json({ error: 'Creatura già attiva' }, { status: 400 })
    if (targetLineup.fainted_at) return NextResponse.json({ error: 'Creatura svenuta' }, { status: 400 })
    if ((targetLineup.current_hp ?? 0) <= 0) return NextResponse.json({ error: 'Creatura senza HP' }, { status: 400 })

    const myField = isChallenger ? 'challenger_creature_id' : 'opponent_creature_id'
    const nextTurnSwitch: 'challenger' | 'opponent' = isChallenger ? 'opponent' : 'challenger'

    await Promise.all([
      myCurrentActive
        ? supabase.from('duel_lineups').update({ is_active: false }).eq('id', myCurrentActive.id)
        : Promise.resolve(),
      supabase.from('duel_lineups').update({ is_active: true }).eq('id', targetLineupId),
      supabase.from('duels').update({
        [myField]: targetLineup.player_creature_id,
        current_turn: nextTurnSwitch,
      }).eq('id', duelId),
    ])

    const switchedToInfo = {
      userId,
      slot: targetLineup.slot,
      playerCreatureId: targetLineup.player_creature_id,
      name: (targetLineup as any).player_creatures?.creatures?.name ?? 'Creatura',
    }

    const switchCh = supabase.channel(`duel:${duelId}`)
    await new Promise<void>(resolve => switchCh.subscribe(() => resolve()))
    await switchCh.send({
      type: 'broadcast',
      event: 'duel_action',
      payload: {
        actorId: userId,
        action: 'switch',
        switchedTo: switchedToInfo,
        nextTurn: nextTurnSwitch,
        duelOver: false,
      },
    })
    await supabase.removeChannel(switchCh)

    return NextResponse.json({ switched: true, switchedTo: switchedToInfo, nextTurn: nextTurnSwitch })
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
      .eq('user_id', userId)
      .eq('session_id', duel.session_id)
      .single()

    const inv = invItem as { id: string; quantity: number; items: { effect_value: number; type: string } } | null
    if (!inv || inv.quantity <= 0 || inv.items?.type !== 'cura') {
      return NextResponse.json({ error: 'Oggetto non valido' }, { status: 400 })
    }

    const { data: allHealLineups } = await supabase
      .from('duel_lineups')
      .select('*, player_creatures(*, creatures(name, element, hp, atk, def, image_url, sprite_cutout_url, sprite_url, rarity, status_effect, status_effect_chance))')
      .eq('duel_id', duelId)
      .order('slot', { ascending: true })

    if (!allHealLineups || allHealLineups.length < 2) {
      return NextResponse.json({ error: 'Lineup non trovato' }, { status: 500 })
    }

    const healLineups = allHealLineups
    const myHealActive = healLineups.find((lineup: any) => lineup.user_id === userId && lineup.is_active)
    if (!myHealActive) return NextResponse.json({ error: 'Nessuna creatura attiva' }, { status: 400 })

    const myHealCreature = (myHealActive as any).player_creatures?.creatures
    if (!myHealCreature) {
      return NextResponse.json({ error: 'Dati creatura non disponibili' }, { status: 500 })
    }

    const { data: healPlayerSessions } = await supabase
      .from('player_sessions')
      .select('user_id, level')
      .eq('session_id', duel.session_id)
      .in('user_id', [userId, oppUserId].filter((v): v is string => Boolean(v)))

    const healLevels = Object.fromEntries(
      (healPlayerSessions ?? []).map((row: { user_id: string; level: number | null }) => [row.user_id, row.level ?? 1]),
    ) as Record<string, number>
    const healEquip = (await getEquipmentBonuses(supabase, [(myHealActive as any).player_creature_id]))
      .get((myHealActive as any).player_creature_id) ?? { hp: 0, atk: 0, def: 0 }
    const healStats = scaleCombatStats(
      { hp: myHealCreature.hp, atk: myHealCreature.atk, def: myHealCreature.def ?? 0 },
      healLevels[userId],
      healEquip,
    )

    const attackerStatus = (myHealActive as any).active_status as StatusEffect | null
    const attackerTurnsLeft = (myHealActive as any).status_turns_left ?? 0
    const nextTurn: 'challenger' | 'opponent' = isChallenger ? 'opponent' : 'challenger'

    async function endHealDuelFromStatusFaint() {
      const allMyFainted = healLineups
        .filter((lineup: any) => lineup.user_id === userId)
        .every((lineup: any) => lineup.id === (myHealActive as any).id || lineup.fainted_at !== null)
      if (allMyFainted) {
        await supabase
          .from('duels')
          .update({ status: 'ended', winner_id: oppUserId, ended_at: new Date().toISOString() })
          .eq('id', duelId)
        await awardDuelResults(supabase, duel!.session_id, oppUserId!, userId)
        incrementMissionProgress({ type: 'duel', userId: oppUserId!, sessionId: duel!.session_id }).then(undefined, () => {})
      }
      return allMyFainted
    }

    async function switchToNextHealCreature() {
      const remaining = healLineups
        .filter((lineup: any) => lineup.user_id === userId && !lineup.fainted_at && lineup.id !== (myHealActive as any).id)
        .sort((a: any, b: any) => a.slot - b.slot)
      const nextMine = remaining[0]
      if (!nextMine) return null

      await supabase.from('duel_lineups').update({ is_active: true }).eq('id', nextMine.id)
      const myField = isChallenger ? 'challenger_creature_id' : 'opponent_creature_id'
      await supabase.from('duels').update({ [myField]: nextMine.player_creature_id }).eq('id', duelId)

      return {
        userId,
        slot: nextMine.slot,
        playerCreatureId: nextMine.player_creature_id,
        name: (nextMine as any).player_creatures?.creatures?.name ?? 'Creatura',
      }
    }

    let preTurnStatusEvent: Record<string, unknown> | null = null
    if (attackerStatus) {
      const statusTick = resolveTurnStartStatus({
        effect: attackerStatus,
        turnsLeft: attackerTurnsLeft,
        currentHp: myHealActive.current_hp,
        maxHp: healStats.hp,
        atk: healStats.atk,
        def: healStats.def,
      })

      await supabase.from('duel_lineups').update({
        active_status: statusTick.nextEffect,
        status_turns_left: statusTick.nextTurnsLeft,
        current_hp: statusTick.currentHp,
        ...(statusTick.fainted ? { fainted_at: new Date().toISOString(), is_active: false } : {}),
      }).eq('id', myHealActive.id)

      if (statusTick.fainted || statusTick.preventedAction) {
        let duelEndedNow = false
        let statusSwitchedTo: { userId: string; slot: number; playerCreatureId: string; name: string } | null = null
        if (statusTick.fainted) {
          duelEndedNow = await endHealDuelFromStatusFaint()
          if (!duelEndedNow) statusSwitchedTo = await switchToNextHealCreature()
        }
        if (!duelEndedNow) {
          await supabase.from('duels').update({ current_turn: nextTurn }).eq('id', duelId)
        }

        const baseStatusEvent = statusTick.event ?? { type: attackerStatus }
        const statusEvent = baseStatusEvent.type === 'veleno'
          ? { ...baseStatusEvent, newMyHp: statusTick.currentHp }
          : baseStatusEvent.type === 'confusione' && baseStatusEvent.selfHit
            ? { ...baseStatusEvent, selfHp: statusTick.currentHp }
            : baseStatusEvent

        const ch = supabase.channel(`duel:${duelId}`)
        await new Promise<void>(resolve => ch.subscribe(() => resolve()))
        await ch.send({
          type: 'broadcast',
          event: 'duel_action',
          payload: {
            actorId: userId,
            action: 'status_tick',
            statusEvent,
            nextTurn: duelEndedNow ? null : nextTurn,
            duelOver: duelEndedNow,
            winnerId: duelEndedNow ? oppUserId : null,
            statusSwitchedTo,
          },
        })
        await supabase.removeChannel(ch)

        return NextResponse.json({
          turnPassed: true,
          statusEffect: attackerStatus,
          duelOver: duelEndedNow,
          ...(statusTick.event?.type === 'veleno' ? { poisonDamage: statusTick.event.poisonDamage } : {}),
          ...(statusTick.event?.type === 'confusione' && statusTick.event.selfHit ? { selfDamage: statusTick.event.selfDamage } : {}),
        })
      }

      if (statusTick.event) {
        preTurnStatusEvent = statusTick.event.type === 'veleno'
          ? { ...statusTick.event, newMyHp: statusTick.currentHp }
          : statusTick.event
      }
    }

    const healAmount = Math.round(healStats.hp * ((inv.items.effect_value ?? 20) / 100))
    const currentHp = preTurnStatusEvent?.type === 'veleno'
      ? Number(preTurnStatusEvent.newMyHp ?? myHealActive.current_hp)
      : myHealActive.current_hp
    const newHp = Math.min(healStats.hp, currentHp + healAmount)

    await Promise.all([
      supabase.from('duel_lineups').update({ current_hp: newHp }).eq('id', (myHealActive as any).id),
      supabase.from('player_inventory').update({ quantity: inv.quantity - 1 }).eq('id', itemId),
      supabase.from('duels').update({ current_turn: nextTurn }).eq('id', duelId),
    ])

    const channel = supabase.channel(`duel:${duelId}`)
    await new Promise<void>(resolve => channel.subscribe(() => resolve()))
    await channel.send({
      type: 'broadcast',
      event: 'duel_action',
      payload: {
        actorId: userId,
        action: 'heal',
        healAmount,
        newHp,
        nextTurn,
        duelOver: false,
        preTurnStatusEvent,
      },
    })
    await supabase.removeChannel(channel)

    return NextResponse.json({ healed: true, healAmount, newHp, nextTurn, preTurnStatusEvent })
  }

  // ── Turn check ─────────────────────────────────────────────────────────────
  if (duel.current_turn !== myRole) {
    return NextResponse.json({ error: 'Non è il tuo turno' }, { status: 409 })
  }

  // ── Load all lineups ───────────────────────────────────────────────────────
  const { data: allLineups } = await supabase
    .from('duel_lineups')
    .select('*, player_creatures(*, creatures(name, element, hp, atk, def, image_url, sprite_cutout_url, sprite_url, rarity, status_effect, status_effect_chance))')
    .eq('duel_id', duelId)
    .order('slot', { ascending: true })

  if (!allLineups || allLineups.length < 2) {
    return NextResponse.json({ error: 'Lineup non trovato' }, { status: 500 })
  }

  const myActive  = allLineups.find(l => l.user_id === userId     && l.is_active)
  const oppActive = allLineups.find(l => l.user_id === oppUserId  && l.is_active)

  if (!myActive || !oppActive) {
    return NextResponse.json({ error: 'Creature attive non trovate' }, { status: 500 })
  }

  const myCreature  = (myActive  as any).player_creatures?.creatures
  const oppCreature = (oppActive as any).player_creatures?.creatures

  if (!myCreature || !oppCreature) {
    return NextResponse.json({ error: 'Dati creature non disponibili' }, { status: 500 })
  }

  const duelUserIds = [userId, oppUserId].filter(Boolean)
  const { data: playerSessions } = await supabase
    .from('player_sessions')
    .select('user_id, level')
    .eq('session_id', duel.session_id)
    .in('user_id', duelUserIds.filter((v): v is string => Boolean(v)))

  const levelByUser = Object.fromEntries(
    (playerSessions ?? []).map((row: { user_id: string; level: number | null }) => [row.user_id, row.level ?? 1]),
  ) as Record<string, number>
  const equipBonusMap = await getEquipmentBonuses(supabase, [
    (myActive as any).player_creature_id,
    (oppActive as any).player_creature_id,
  ])
  const myEquipBonus = equipBonusMap.get((myActive as any).player_creature_id) ?? { hp: 0, atk: 0, def: 0 }
  const oppEquipBonus = equipBonusMap.get((oppActive as any).player_creature_id) ?? { hp: 0, atk: 0, def: 0 }
  const myCombatStats = scaleCombatStats(
    { hp: myCreature.hp, atk: myCreature.atk, def: myCreature.def ?? 0 },
    levelByUser[userId],
    myEquipBonus,
  )
  const oppCombatStats = scaleCombatStats(
    { hp: oppCreature.hp, atk: oppCreature.atk, def: oppCreature.def ?? 0 },
    levelByUser[oppUserId!] ?? 1,
    oppEquipBonus,
  )

  // ── Special ability setup (per-lineup ability_state) ───────────────────────
  let myState: AbilityBattleState = normalizeAbilityState((myActive as { ability_state?: unknown }).ability_state)
  let oppState: AbilityBattleState = normalizeAbilityState((oppActive as { ability_state?: unknown }).ability_state)
  const abilitiesActive = (myActive as { ability_state?: unknown }).ability_state != null || !!abilityId
  const pendingAbilityId = myState.pending?.abilityId ?? null
  const effectiveAbilityId: string | null = pendingAbilityId ?? (abilityId ?? null)
  let castAbility: Ability | null = null
  if (effectiveAbilityId) {
    const abRes = await supabase.from('abilities').select('*').eq('id', effectiveAbilityId).maybeSingle()
    if (abRes.data) {
      if (pendingAbilityId) {
        castAbility = abRes.data as unknown as Ability
      } else {
        const known = await supabase.from('creature_abilities').select('ability_id')
          .eq('player_creature_id', (myActive as { player_creature_id: string }).player_creature_id)
          .eq('ability_id', effectiveAbilityId).maybeSingle()
        if (known.data) castAbility = abRes.data as unknown as Ability
      }
    }
  }
  let abilityRecharging = false
  if (abilitiesActive) {
    const abTick = tickAbilityState(myState)
    myState = abTick.state
    abilityRecharging = abTick.recharging
  }
  if (castAbility && !pendingAbilityId && !abilityRecharging) {
    const usable = isAbilityUsable(castAbility, myState)
    if (!usable.usable) return NextResponse.json({ error: usable.reason ?? 'Mossa non disponibile' }, { status: 400 })
  }

  // ── Status effect pre-turn processing ─────────────────────────────────────
  const attackerStatus    = (myActive as any).active_status as StatusEffect | null
  const attackerTurnsLeft = (myActive as any).status_turns_left ?? 0
  const nextTurnRole: 'challenger' | 'opponent' = isChallenger ? 'opponent' : 'challenger'
  const currentUserId = userId
  const duelLineups = allLineups ?? []

  // Helper: end duel when the attacker faints from a status effect
  async function endDuelFromStatusFaint() {
    const allMyFainted = duelLineups
      .filter((l: any) => l.user_id === currentUserId)
      .every((l: any) => l.id === (myActive as any).id || l.fainted_at !== null)
    if (allMyFainted) {
      await supabase.from('duels').update({ status: 'ended', winner_id: oppUserId, ended_at: new Date().toISOString() }).eq('id', duelId)
      await awardDuelResults(supabase, duel!.session_id, oppUserId!, currentUserId)
      incrementMissionProgress({ type: 'duel', userId: oppUserId!, sessionId: duel!.session_id }).then(undefined, () => {})
    }
    return allMyFainted
  }

  async function switchToNextMyCreature() {
    const myRemaining = duelLineups
      .filter((l: any) => l.user_id === currentUserId && !l.fainted_at && l.id !== (myActive as any).id)
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

  let preTurnStatusEvent: Record<string, unknown> | null = null

  if (attackerStatus) {
    const statusTick = resolveTurnStartStatus({
      effect: attackerStatus,
      turnsLeft: attackerTurnsLeft,
      currentHp: myActive.current_hp,
      maxHp: myCombatStats.hp,
      atk: myCombatStats.atk,
      def: myCombatStats.def,
    })

    await supabase.from('duel_lineups').update({
      active_status: statusTick.nextEffect,
      status_turns_left: statusTick.nextTurnsLeft,
      current_hp: statusTick.currentHp,
      ...(statusTick.fainted ? { fainted_at: new Date().toISOString(), is_active: false } : {}),
    }).eq('id', myActive.id)

    if (statusTick.fainted || statusTick.preventedAction) {
      let duelEndedNow = false
      let statusSwitchedTo: { userId: string; slot: number; playerCreatureId: string; name: string } | null = null
      if (statusTick.fainted) {
        duelEndedNow = await endDuelFromStatusFaint()
        if (!duelEndedNow) statusSwitchedTo = await switchToNextMyCreature()
      }
      if (!duelEndedNow) {
        await supabase.from('duels').update({ current_turn: nextTurnRole }).eq('id', duelId)
      }

      const baseStatusEvent = statusTick.event ?? { type: attackerStatus }
      const statusEvent = baseStatusEvent.type === 'veleno'
        ? { ...baseStatusEvent, newMyHp: statusTick.currentHp }
        : baseStatusEvent.type === 'confusione' && baseStatusEvent.selfHit
          ? { ...baseStatusEvent, selfHp: statusTick.currentHp }
          : baseStatusEvent

      const ch = supabase.channel(`duel:${duelId}`)
      await new Promise<void>(r => ch.subscribe(() => r()))
      await ch.send({ type: 'broadcast', event: 'duel_action', payload: {
        actorId: userId,
        action: 'status_tick',
        statusEvent,
        nextTurn: duelEndedNow ? null : nextTurnRole,
        duelOver: duelEndedNow,
        winnerId: duelEndedNow ? oppUserId : null,
        statusSwitchedTo,
      }})
      await supabase.removeChannel(ch)

      return NextResponse.json({
        turnPassed: true,
        statusEffect: attackerStatus,
        duelOver: duelEndedNow,
        ...(statusTick.event?.type === 'veleno' ? { poisonDamage: statusTick.event.poisonDamage } : {}),
        ...(statusTick.event?.type === 'confusione' && statusTick.event.selfHit ? { selfDamage: statusTick.event.selfDamage } : {}),
      })
    }

    if (statusTick.event) {
      preTurnStatusEvent = statusTick.event.type === 'veleno'
        ? { ...statusTick.event, newMyHp: statusTick.currentHp }
        : statusTick.event
    }
  }

  // ── Optional battaglia item ────────────────────────────────────────────────
  let atkMultiplier = 1
  if (itemId) {
    const { data: invItem } = await supabase
      .from('player_inventory')
      .select('quantity, items(effect_value, type)')
      .eq('id', itemId)
      .eq('user_id', userId)
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

  // ── Damage / ability resolution ────────────────────────────────────────────
  let mult = getElementMultiplier(myCreature.element as Element, oppCreature.element as Element)
  let fortune: ReturnType<typeof rollCombatFortune> | null = null
  let isCrit = false
  let damage = 0
  let abilityStatusToOpp: StatusEffect | null = null
  let abilitySelfStatus: StatusEffect | null = null
  let abilityHealToMe = 0
  let abilityCharging = false
  let abilityMissed = false
  let abilityAnimationKey: string | null = null

  // Self-buffs/enemy-debuffs are 0 unless abilities are in play (→ identical maths).
  const effMy = applyStatMods(myCombatStats.atk, myCombatStats.def, myState)
  const effOppDef = applyStatMods(oppCombatStats.atk, oppCombatStats.def, oppState).def

  if (abilityRecharging) {
    // Forced recharge turn — the creature cannot attack.
  } else if (castAbility) {
    const outcome = resolveAbilityCast({
      ability: castAbility,
      casterElement: myCreature.element as Element,
      targetElement: oppCreature.element as Element,
      casterAtk: effMy.atk,
      casterDef: effMy.def,
      casterMaxHp: myCombatStats.hp,
      casterHp: myActive.current_hp,
      casterStatus: (myActive as { active_status?: StatusEffect | null }).active_status ?? null,
      targetDef: effOppDef,
      targetStatus: (oppActive as { active_status?: StatusEffect | null }).active_status ?? null,
      state: myState,
    })
    myState = outcome.nextState
    abilityAnimationKey = outcome.animationKey
    if (outcome.phase === 'charging') {
      abilityCharging = true
    } else if (outcome.phase === 'fired' && !outcome.missed) {
      damage = outcome.totalDamage
      isCrit = outcome.isCrit
      mult = outcome.elementMultiplier
      abilityHealToMe = outcome.healToCaster
      abilityStatusToOpp = outcome.statusToTarget
      abilitySelfStatus = outcome.selfStatus
      myState = addSelfBuffs(myState, outcome.buffs)
      if (outcome.debuffs.atk || outcome.debuffs.def) oppState = addEnemyDebuffs(oppState, outcome.debuffs)
    } else if (outcome.phase === 'fired' && outcome.missed) {
      abilityMissed = true
    }
  } else {
    fortune = rollCombatFortune({
      attackerLevel: levelByUser[userId],
      defenderLevel: levelByUser[oppUserId!] ?? 1,
      attackerStats: myCombatStats,
      defenderStats: oppCombatStats,
    })
    const crit = rollCrit()
    isCrit = crit.isCrit
    damage = calculateCombatDamage({
      attackerAtk: effMy.atk,
      defenderDef: effOppDef,
      attackMultiplier: atkMultiplier * crit.critMultiplier,
      elementMultiplier: mult,
      varianceMultiplier: fortune.multiplier,
    })
  }
  const newOppHp = Math.max(0, oppActive.current_hp - damage)

  // Update opponent active creature HP (+ ability_state for debuffs; mark fainted if dead)
  await supabase
    .from('duel_lineups')
    .update({
      current_hp: newOppHp,
      ...(abilitiesActive ? { ability_state: oppState as unknown as Json } : {}),
      ...(newOppHp === 0 ? { fainted_at: new Date().toISOString(), is_active: false } : {}),
    })
    .eq('id', oppActive.id)

  // Persist the attacker's ability state (cooldowns/charge/PP/buffs) + any heal / self-status.
  if (abilitiesActive) {
    const healedHp = abilityHealToMe > 0
      ? Math.min(myCombatStats.hp, myActive.current_hp + abilityHealToMe)
      : myActive.current_hp
    await supabase.from('duel_lineups').update({
      current_hp: healedHp,
      ability_state: myState as unknown as Json,
      ...(abilitySelfStatus ? { active_status: abilitySelfStatus, status_turns_left: STATUS_EFFECT_META[abilitySelfStatus].turns } : {}),
    }).eq('id', myActive.id)
    myActive.current_hp = healedHp
  }

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
      winnerId = userId
      await supabase
        .from('duels')
        .update({ status: 'ended', winner_id: userId, ended_at: new Date().toISOString() })
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
    if (abilityStatusToOpp) {
      // Ability-inflicted status (already rolled by the resolver).
      statusAppliedToOpp = abilityStatusToOpp
      oppStatusTurnsLeft = STATUS_EFFECT_META[abilityStatusToOpp].turns
      await supabase.from('duel_lineups').update({
        active_status: abilityStatusToOpp,
        status_turns_left: oppStatusTurnsLeft,
      }).eq('id', oppActive.id)
    } else if (!castAbility) {
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
  }

  // Flip turn to opponent (status is already written above, before this update)
  if (!duelOver) {
    await supabase.from('duels').update({ current_turn: nextTurn }).eq('id', duelId)
  }

  const poisonEvent: null = null
  const velenoDuelOver = false

  // ── Awards ─────────────────────────────────────────────────────────────────
  let myLevelUp: { newLevel: number; goldReward: number } | null = null
  let completedMissions: CompletedMission[] = []
  if (duelOver) {
    const [levelUps, missions] = await Promise.all([
      awardDuelResults(supabase, duel.session_id, userId, oppUserId!),
      incrementMissionProgress({ type: 'duel', userId, sessionId: duel.session_id }).catch(() => [] as CompletedMission[]),
    ])
    myLevelUp = levelUps.winnerLevelUp
    completedMissions = missions
    // Save game events for bell history
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = createAdminClient()
    // Build creature summaries from allLineups for event payload
    const myCreatures   = buildCreatureSummaries(allLineups ?? [], userId)
    const oppCreatures  = buildCreatureSummaries(allLineups ?? [], oppUserId!)
    // Fetch opponent nickname
    const { data: profileRows } = await adminClient.from('profiles').select('user_id, nickname').in('user_id', [userId, oppUserId!])
    const profileMap: Record<string, string | null> = Object.fromEntries(
      (profileRows ?? []).map((r: any) => [r.user_id, r.nickname ?? null])
    )
    const eventsToInsert = [
      { user_id: userId,     session_id: duel.session_id, type: 'duel_won',  payload: { opponent_id: oppUserId, opponent_name: profileMap[oppUserId!] ?? null, exp: DUEL_WIN_EXP, gold: DUEL_WIN_GOLD, my_creatures: myCreatures, opp_creatures: oppCreatures } },
      { user_id: oppUserId!, session_id: duel.session_id, type: 'duel_lost', payload: { winner_id: userId, winner_name: profileMap[userId] ?? null, my_creatures: oppCreatures, opp_creatures: myCreatures } },
    ]
    adminClient.from('player_game_events').insert(eventsToInsert).then(undefined, () => {})
    if (myLevelUp) {
      adminClient.from('player_game_events').insert({
        user_id: userId,
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
      actorId: userId,
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
      abilityUsed: castAbility ? { id: castAbility.id, name: castAbility.name } : null,
      abilityAnimationKey,
      abilityCharging,
      abilityMissed,
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
    abilityUsed: castAbility ? { id: castAbility.id, name: castAbility.name } : null,
    abilityAnimationKey,
    abilityCharging,
    abilityMissed,
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
        image_url: cr.sprite_cutout_url || cr.sprite_url || cr.image_url || null,
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
