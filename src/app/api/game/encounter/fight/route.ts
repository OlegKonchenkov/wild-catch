import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateFightDamage, getCatchHealthMultiplier } from '@/lib/game/rng'
import { calculatePoisonDamage, rollStatusEffect, STATUS_EFFECT_META } from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import { getElementMultiplier } from '@/lib/game/elements'
import type { Element } from '@/lib/types'

const RARE_TIERS = ['raro', 'epico', 'leggendario', 'mitologico']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { encounterId, itemId, activePlayerCreatureId } = body

  if (!encounterId) return NextResponse.json({ error: 'encounterId mancante' }, { status: 400 })

  // Get encounter with creature data (including status columns from migration 022)
  const { data: encounter } = await supabase
    .from('encounters')
    .select('*, creatures(*)')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!encounter) return NextResponse.json({ error: 'Incontro non trovato' }, { status: 404 })

  // Guard: session must still be active
  const { data: sessionCheck } = await supabase.from('sessions').select('status').eq('id', encounter.session_id).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    const notStarted = sessionCheck?.status === 'draft' || sessionCheck?.status === 'ready'
    const errMsg = notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
    return NextResponse.json({ error: errMsg }, { status: 403 })
  }

  const wildCreature = (encounter as any).creatures

  if (!encounter.player_creature_id && !activePlayerCreatureId) {
    return NextResponse.json({
      error: 'Nessuna creatura selezionata. Seleziona una creatura dal DaimonDex prima di combattere.'
    }, { status: 400 })
  }

  // Use activePlayerCreatureId (squad switch) if provided, else the locked encounter creature
  const lookupId = activePlayerCreatureId ?? encounter.player_creature_id

  const { data: playerCreature } = await supabase
    .from('player_creatures')
    .select('*, creatures(*)')
    .eq('id', lookupId)
    .eq('user_id', user.id)
    .single()

  if (!playerCreature) return NextResponse.json({ error: 'Creatura giocatore non trovata' }, { status: 404 })

  const playerCr = (playerCreature as any).creatures
  const isRarePlus = RARE_TIERS.includes(wildCreature.rarity)

  // Apply item effect: battaglia = ATK boost, pozione = anti-weakness (caps element mult at 1.0)
  let atkMultiplier = 1
  let antiWeakness = false
  if (itemId) {
    const { data: invItem } = await supabase
      .from('player_inventory')
      .select('quantity, items(effect_value, type)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single()

    const inv = invItem as { quantity: number; items: { effect_value: number; type: string } } | null
    if (inv && inv.quantity > 0) {
      if (inv.items?.type === 'battaglia') {
        atkMultiplier = 1 + (inv.items.effect_value ?? 0) / 100
        await supabase.from('player_inventory').update({ quantity: inv.quantity - 1 }).eq('id', itemId)
      } else if (inv.items?.type === 'pozione') {
        // REQ-INV-04: anti-weakness — neutralise type disadvantage (cap element mult at 1.0)
        antiWeakness = true
        await supabase.from('player_inventory').update({ quantity: inv.quantity - 1 }).eq('id', itemId)
      }
    }
  }

  // ── Status effect state from encounter columns ────────────────────────────
  const wildStatus      = (encounter as any).wild_status      as StatusEffect | null
  const wildStatusTurns = (encounter as any).wild_status_turns  ?? 0
  const playerStatus    = (encounter as any).player_status    as StatusEffect | null
  const playerStatusTurns = (encounter as any).player_status_turns ?? 0

  let wildHpRemaining = encounter.wild_creature_hp
  let playerTookDamage = false
  let playerDamage = 0
  let wildDamage = 0

  // ── Status effect pre-turn processing ────────────────────────────────────
  const statusEvents: Record<string, unknown>[] = []
  let newWildStatus: StatusEffect | null = wildStatus
  let newWildStatusTurns = wildStatusTurns
  let newPlayerStatus: StatusEffect | null = playerStatus
  let newPlayerStatusTurns = playerStatusTurns
  let skipPlayerAttack = false
  let skipWildAttack = false

  // Veleno tick on wild
  if (wildStatus === 'veleno') {
    const poisonDmg = calculatePoisonDamage(wildCreature.hp)
    wildHpRemaining = Math.max(0, wildHpRemaining - poisonDmg)
    statusEvents.push({ type: 'veleno', target: 'wild', poisonDamage: poisonDmg, newHp: wildHpRemaining })
  }

  // Paralisi / Sonno: skip wild attack (affects counter-attack below)
  if (wildStatus === 'paralisi' || wildStatus === 'sonno') {
    const newT = wildStatusTurns - 1
    const cleared = newT <= 0
    newWildStatus = cleared ? null : wildStatus
    newWildStatusTurns = Math.max(0, newT)
    skipWildAttack = true
    statusEvents.push({ type: wildStatus, target: 'wild', turnPassed: true, cleared, turnsLeft: Math.max(0, newT) })
  } else if (wildStatus === 'confusione') {
    const newT = wildStatusTurns - 1
    const cleared = newT <= 0
    newWildStatus = cleared ? null : 'confusione'
    newWildStatusTurns = Math.max(0, newT)
    if (Math.random() < 0.5) {
      skipWildAttack = true
      statusEvents.push({ type: 'confusione', target: 'wild', selfHit: true, cleared, turnsLeft: Math.max(0, newT) })
    } else {
      statusEvents.push({ type: 'confusione', target: 'wild', selfHit: false, cleared, turnsLeft: Math.max(0, newT) })
    }
  }

  // Paralisi / Sonno: skip player attack
  if (playerStatus === 'paralisi' || playerStatus === 'sonno') {
    const newT = playerStatusTurns - 1
    const cleared = newT <= 0
    newPlayerStatus = cleared ? null : playerStatus
    newPlayerStatusTurns = Math.max(0, newT)
    skipPlayerAttack = true
    statusEvents.push({ type: playerStatus, target: 'player', turnPassed: true, cleared, turnsLeft: Math.max(0, newT) })
  } else if (playerStatus === 'confusione') {
    const newT = playerStatusTurns - 1
    const cleared = newT <= 0
    newPlayerStatus = cleared ? null : 'confusione'
    newPlayerStatusTurns = Math.max(0, newT)
    if (Math.random() < 0.5) {
      skipPlayerAttack = true
      statusEvents.push({ type: 'confusione', target: 'player', selfHit: true, cleared, turnsLeft: Math.max(0, newT) })
    } else {
      statusEvents.push({ type: 'confusione', target: 'player', selfHit: false, cleared, turnsLeft: Math.max(0, newT) })
    }
  }

  // ── Combat ────────────────────────────────────────────────────────────────
  // Rara+ attacks first (if not skipped by status)
  if (isRarePlus && !skipWildAttack) {
    wildDamage = calculateFightDamage(wildCreature.atk)
    playerTookDamage = true
  }

  // Player attacks with element multiplier (if not skipped by status)
  let elementMult = getElementMultiplier(
    playerCr.element as Element,
    wildCreature.element as Element
  )
  // REQ-INV-04: anti-weakness potion neutralises disadvantage (mult < 1 → 1)
  if (antiWeakness && elementMult < 1) elementMult = 1
  const playerCrit = Math.random() < 0.10
  const critMult   = playerCrit ? 1.75 : 1
  if (!skipPlayerAttack && wildHpRemaining > 0) {
    playerDamage = Math.round(calculateFightDamage(playerCr.atk) * elementMult * atkMultiplier * critMult)
    wildHpRemaining = Math.max(0, wildHpRemaining - playerDamage)
  }

  // ── Roll player→wild status BEFORE non-rare counter-attack ────────────────
  // This ensures paralisi/sonno applied this turn prevents the counter-attack
  // in the same action (otherwise the creature would attack and then be frozen).
  let statusAppliedToWild: StatusEffect | null = null
  let wildNewStatusTurns = 0
  if (playerDamage > 0 && wildHpRemaining > 0) {
    const triggered = rollStatusEffect(playerCr.status_effect as StatusEffect | null, playerCr.status_effect_chance)
    if (triggered) {
      statusAppliedToWild = triggered
      wildNewStatusTurns = STATUS_EFFECT_META[triggered].turns
      newWildStatus = triggered          // re-applies and resets counter if already has a status
      newWildStatusTurns = wildNewStatusTurns
      // Immobilising effects block the counter-attack this same turn
      if (triggered === 'paralisi' || triggered === 'sonno') {
        skipWildAttack = true
      }
    }
  }

  // Non-rare attacks after player (if not skipped by status — now includes freshly applied)
  if (!isRarePlus && wildHpRemaining > 0 && !skipWildAttack) {
    wildDamage = calculateFightDamage(wildCreature.atk)
    playerTookDamage = true
  }

  // ── Wild→player status application ───────────────────────────────────────
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

  // ── Determine outcome ─────────────────────────────────────────────────────
  let fightResult: 'ongoing' | 'fled' | 'catchable' = 'ongoing'

  const hpRatioAfter = wildHpRemaining / wildCreature.hp
  if (wildHpRemaining === 0) {
    fightResult = 'fled'  // HP 0 = flees
  } else if (hpRatioAfter <= 0.50) {
    fightResult = 'catchable'  // ≤50% HP = catch bonus active
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

  // REQ-XP-02: nessun XP per attacchi — XP solo da cattura

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
