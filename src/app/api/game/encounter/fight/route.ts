import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateFightDamage, getCatchHealthMultiplier } from '@/lib/game/rng'
import {
  calculateConfusionSelfDamage,
  calculatePoisonDamage,
  rollConfusionSelfHit,
  rollParalysisSkip,
  rollStatusEffect,
  shouldSkipCounterattackOnStatusApply,
  STATUS_EFFECT_META,
} from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import { getElementMultiplier } from '@/lib/game/elements'
import type { Element } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { encounterId, itemId, activePlayerCreatureId, clearPlayerStatus } = body

  if (!encounterId) {
    return NextResponse.json({ error: 'encounterId mancante' }, { status: 400 })
  }

  const { data: encounter } = await supabase
    .from('encounters')
    .select('*, creatures(*)')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!encounter) {
    return NextResponse.json({ error: 'Incontro non trovato' }, { status: 404 })
  }

  const { data: sessionCheck } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', encounter.session_id)
    .single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    const notStarted = sessionCheck?.status === 'draft' || sessionCheck?.status === 'ready'
    const errMsg = notStarted ? 'La sessione non e ancora iniziata' : 'La sessione e terminata'
    return NextResponse.json({ error: errMsg }, { status: 403 })
  }

  const wildCreature = (encounter as any).creatures

  if (!encounter.player_creature_id && !activePlayerCreatureId) {
    return NextResponse.json({
      error: 'Nessuna creatura selezionata. Seleziona una creatura dal DaimonDex prima di combattere.',
    }, { status: 400 })
  }

  const lookupId = activePlayerCreatureId ?? encounter.player_creature_id
  const { data: playerCreature } = await supabase
    .from('player_creatures')
    .select('*, creatures(*)')
    .eq('id', lookupId)
    .eq('user_id', user.id)
    .single()

  if (!playerCreature) {
    return NextResponse.json({ error: 'Creatura giocatore non trovata' }, { status: 404 })
  }

  const playerCr = (playerCreature as any).creatures

  let atkMultiplier = 1
  let antiWeakness = false
  let attackItemType: string | null = null
  let attackItemEffectValue = 0
  let attackItemQuantity = 0

  if (itemId) {
    const { data: invItem } = await supabase
      .from('player_inventory')
      .select('quantity, items(effect_value, type)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single()

    const inv = invItem as { quantity: number; items: { effect_value: number; type: string } } | null
    if (inv && inv.quantity > 0) {
      attackItemType = inv.items?.type ?? null
      attackItemEffectValue = inv.items?.effect_value ?? 0
      attackItemQuantity = inv.quantity
    }
  }

  const wildStatus = (encounter as any).wild_status as StatusEffect | null
  const wildStatusTurns = (encounter as any).wild_status_turns ?? 0
  const playerStatus = clearPlayerStatus ? null : ((encounter as any).player_status as StatusEffect | null)
  const playerStatusTurns = clearPlayerStatus ? 0 : ((encounter as any).player_status_turns ?? 0)

  let wildHpRemaining = encounter.wild_creature_hp
  let playerTookDamage = false
  let playerDamage = 0
  let wildDamage = 0

  const statusEvents: Record<string, unknown>[] = []
  let newWildStatus: StatusEffect | null = wildStatus
  let newWildStatusTurns = wildStatusTurns
  let newPlayerStatus: StatusEffect | null = playerStatus
  let newPlayerStatusTurns = playerStatusTurns
  let skipPlayerAttack = false
  let skipWildAttack = false

  if (wildStatus === 'veleno') {
    const poisonDmg = calculatePoisonDamage(wildCreature.hp)
    wildHpRemaining = Math.max(0, wildHpRemaining - poisonDmg)
    statusEvents.push({ type: 'veleno', target: 'wild', poisonDamage: poisonDmg, newHp: wildHpRemaining })
  }

  if (playerStatus === 'veleno') {
    const poisonDmg = calculatePoisonDamage(playerCr.hp)
    statusEvents.push({ type: 'veleno', target: 'player', poisonDamage: poisonDmg })
  }

  if (wildStatus === 'sonno') {
    const newTurns = wildStatusTurns - 1
    const cleared = newTurns <= 0
    newWildStatus = cleared ? null : 'sonno'
    newWildStatusTurns = Math.max(0, newTurns)
    skipWildAttack = true
    statusEvents.push({ type: 'sonno', target: 'wild', turnPassed: true, cleared, turnsLeft: Math.max(0, newTurns) })
  } else if (wildStatus === 'paralisi') {
    const newTurns = wildStatusTurns - 1
    const cleared = newTurns <= 0
    newWildStatus = cleared ? null : 'paralisi'
    newWildStatusTurns = Math.max(0, newTurns)
    const paralysisSkip = rollParalysisSkip()
    if (paralysisSkip) skipWildAttack = true
    statusEvents.push({ type: 'paralisi', target: 'wild', paralysisSkip, cleared, turnsLeft: Math.max(0, newTurns) })
  } else if (wildStatus === 'confusione') {
    const newTurns = wildStatusTurns - 1
    const cleared = newTurns <= 0
    newWildStatus = cleared ? null : 'confusione'
    newWildStatusTurns = Math.max(0, newTurns)
    if (rollConfusionSelfHit()) {
      skipWildAttack = true
      const selfDamage = calculateConfusionSelfDamage(wildCreature.atk, wildCreature.def ?? 0)
      wildHpRemaining = Math.max(0, wildHpRemaining - selfDamage)
      statusEvents.push({
        type: 'confusione',
        target: 'wild',
        selfHit: true,
        selfDamage,
        newHp: wildHpRemaining,
        fainted: wildHpRemaining === 0,
        cleared,
        turnsLeft: Math.max(0, newTurns),
      })
    } else {
      statusEvents.push({ type: 'confusione', target: 'wild', selfHit: false, cleared, turnsLeft: Math.max(0, newTurns) })
    }
  }

  if (playerStatus === 'sonno') {
    const newTurns = playerStatusTurns - 1
    const cleared = newTurns <= 0
    newPlayerStatus = cleared ? null : 'sonno'
    newPlayerStatusTurns = Math.max(0, newTurns)
    skipPlayerAttack = true
    statusEvents.push({ type: 'sonno', target: 'player', turnPassed: true, cleared, turnsLeft: Math.max(0, newTurns) })
  } else if (playerStatus === 'paralisi') {
    const newTurns = playerStatusTurns - 1
    const cleared = newTurns <= 0
    newPlayerStatus = cleared ? null : 'paralisi'
    newPlayerStatusTurns = Math.max(0, newTurns)
    const paralysisSkip = rollParalysisSkip()
    if (paralysisSkip) skipPlayerAttack = true
    statusEvents.push({ type: 'paralisi', target: 'player', paralysisSkip, cleared, turnsLeft: Math.max(0, newTurns) })
  } else if (playerStatus === 'confusione') {
    const newTurns = playerStatusTurns - 1
    const cleared = newTurns <= 0
    newPlayerStatus = cleared ? null : 'confusione'
    newPlayerStatusTurns = Math.max(0, newTurns)
    if (rollConfusionSelfHit()) {
      skipPlayerAttack = true
      const selfDamage = calculateConfusionSelfDamage(playerCr.atk, playerCr.def ?? 0)
      statusEvents.push({
        type: 'confusione',
        target: 'player',
        selfHit: true,
        selfDamage,
        cleared,
        turnsLeft: Math.max(0, newTurns),
      })
    } else {
      statusEvents.push({ type: 'confusione', target: 'player', selfHit: false, cleared, turnsLeft: Math.max(0, newTurns) })
    }
  }

  if (!skipPlayerAttack && wildHpRemaining > 0 && itemId && attackItemQuantity > 0) {
    if (attackItemType === 'battaglia') {
      atkMultiplier = 1 + attackItemEffectValue / 100
      await supabase.from('player_inventory').update({ quantity: attackItemQuantity - 1 }).eq('id', itemId)
    } else if (attackItemType === 'pozione') {
      antiWeakness = true
      await supabase.from('player_inventory').update({ quantity: attackItemQuantity - 1 }).eq('id', itemId)
    }
  }

  let elementMult = getElementMultiplier(
    playerCr.element as Element,
    wildCreature.element as Element,
  )
  if (antiWeakness && elementMult < 1) elementMult = 1

  const playerCrit = Math.random() < 0.10
  const critMult = playerCrit ? 1.75 : 1
  if (!skipPlayerAttack && wildHpRemaining > 0) {
    playerDamage = Math.round(calculateFightDamage(playerCr.atk) * elementMult * atkMultiplier * critMult)
    wildHpRemaining = Math.max(0, wildHpRemaining - playerDamage)
  }

  let statusAppliedToWild: StatusEffect | null = null
  let wildNewStatusTurns = 0
  if (playerDamage > 0 && wildHpRemaining > 0) {
    const triggered = rollStatusEffect(playerCr.status_effect as StatusEffect | null, playerCr.status_effect_chance)
    if (triggered) {
      statusAppliedToWild = triggered
      wildNewStatusTurns = STATUS_EFFECT_META[triggered].turns
      newWildStatus = triggered
      newWildStatusTurns = wildNewStatusTurns
      if (shouldSkipCounterattackOnStatusApply(triggered)) {
        skipWildAttack = true
      }
    }
  }

  if (wildHpRemaining > 0 && !skipWildAttack) {
    wildDamage = calculateFightDamage(wildCreature.atk)
    playerTookDamage = true
  }

  let statusAppliedToPlayer: StatusEffect | null = null
  let playerNewStatusTurns = 0
  if (wildDamage > 0) {
    const triggered = rollStatusEffect(wildCreature.status_effect as StatusEffect | null, wildCreature.status_effect_chance)
    if (triggered) {
      statusAppliedToPlayer = triggered
      playerNewStatusTurns = STATUS_EFFECT_META[triggered].turns
      newPlayerStatus = triggered
      newPlayerStatusTurns = playerNewStatusTurns
    }
  }

  let fightResult: 'ongoing' | 'fled' | 'catchable' = 'ongoing'
  const hpRatioAfter = wildHpRemaining / wildCreature.hp
  if (wildHpRemaining === 0) {
    fightResult = 'fled'
  } else if (hpRatioAfter <= 0.5) {
    fightResult = 'catchable'
  }

  const catchMultiplier = getCatchHealthMultiplier(wildHpRemaining, wildCreature.hp)

  await supabase
    .from('encounters')
    .update({
      wild_creature_hp: wildHpRemaining,
      status: fightResult === 'fled' ? 'fought' : 'active',
      resolved_at: fightResult === 'fled' ? new Date().toISOString() : null,
      wild_status: fightResult === 'fled' ? null : newWildStatus,
      wild_status_turns: fightResult === 'fled' ? 0 : newWildStatusTurns,
      player_status: fightResult === 'fled' ? null : newPlayerStatus,
      player_status_turns: fightResult === 'fled' ? 0 : newPlayerStatusTurns,
    })
    .eq('id', encounterId)

  return NextResponse.json({
    wildHpRemaining,
    wildHpMax: wildCreature.hp,
    playerDamage,
    wildDamage,
    playerTookDamage,
    elementMultiplier: elementMult,
    playerCrit,
    fightResult,
    catchMultiplier,
    levelUp: null,
    statusEvents,
    statusAppliedToWild,
    wildNewStatusTurns,
    statusAppliedToPlayer,
    playerNewStatusTurns,
  })
}
