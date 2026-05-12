import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { calculateFightDamage, getCatchHealthMultiplier } from '@/lib/game/rng'
import {
  resolveTurnStartStatus,
  rollStatusEffect,
  STATUS_EFFECT_META,
} from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'

/**
 * POST /api/game/encounter/switch
 *
 * Sostituisce la creatura attiva del giocatore senza attaccare. Equivale a
 * passare il turno: il wild esegue il proprio status tick + attacco contro la
 * nuova creatura entrante. Lo status del giocatore precedente si azzera (la
 * creatura uscita lo "porta via" con sé), un nuovo status può essere applicato
 * dall'attacco del wild come in un normale fight.
 *
 * Body: { encounterId, newActivePcId, currentPlayerHp }
 *  - newActivePcId: id di player_creatures della creatura entrante
 *  - currentPlayerHp: HP correnti della creatura entrante (slotHps[newSlot])
 *
 * Risposta: stessa shape di /fight per riusare la logica di animazione client.
 *  - playerDamage = 0 (non attacchiamo mai in switch)
 *  - playerCrit  = false
 *  - elementMultiplier = 1
 *  - skipPlayerAttack = true (per chiarezza al client)
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('encounter_act', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const body = await request.json().catch(() => ({}))
  const { encounterId, newActivePcId, currentPlayerHp } = body

  if (!encounterId || !newActivePcId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  const { data: encounter } = await supabase
    .from('encounters')
    .select('*, creatures(*)')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!encounter) return NextResponse.json({ error: 'Incontro non trovato' }, { status: 404 })

  const { data: sessionCheck } = await supabase
    .from('sessions').select('status').eq('id', encounter.session_id).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'La sessione e terminata' }, { status: 403 })
  }

  // Validate the requested player_creature belongs to the user
  const { data: newPc } = await supabase
    .from('player_creatures')
    .select('id, creatures(*)')
    .eq('id', newActivePcId)
    .eq('user_id', user.id)
    .single()

  if (!newPc) return NextResponse.json({ error: 'Creatura non valida' }, { status: 404 })

  const newPlayerCr = (newPc as any).creatures
  const wildCreature = (encounter as any).creatures

  // Sanity: never switch to a fainted creature (defensive — UI prevents it)
  const incomingHp = Math.max(0, Math.min(
    Number.isFinite(currentPlayerHp) ? Number(currentPlayerHp) : newPlayerCr.hp,
    newPlayerCr.hp,
  ))
  if (incomingHp <= 0) {
    return NextResponse.json({ error: 'Creatura priva di HP' }, { status: 400 })
  }

  let wildHpRemaining = encounter.wild_creature_hp
  let playerHpRemaining = incomingHp

  // Player status resets on switch — the new creature comes in clean.
  const newPlayerStatusBefore: StatusEffect | null = null

  const wildStatus = (encounter as any).wild_status as StatusEffect | null
  const wildStatusTurns = (encounter as any).wild_status_turns ?? 0
  let newWildStatus: StatusEffect | null = wildStatus
  let newWildStatusTurns = wildStatusTurns
  let skipWildAttack = false

  const statusEvents: Record<string, unknown>[] = []

  // Wild's status tick (sleep, poison, etc) — same as in /fight
  if (wildHpRemaining > 0) {
    const wildStatusTick = resolveTurnStartStatus({
      effect: newWildStatus,
      turnsLeft: newWildStatusTurns,
      currentHp: wildHpRemaining,
      maxHp: wildCreature.hp,
      atk: wildCreature.atk,
      def: wildCreature.def ?? 0,
    })
    wildHpRemaining = wildStatusTick.currentHp
    newWildStatus = wildStatusTick.nextEffect
    newWildStatusTurns = wildStatusTick.nextTurnsLeft
    if (wildStatusTick.event) {
      statusEvents.push({ ...wildStatusTick.event, target: 'wild' })
    }
    if (wildStatusTick.preventedAction || wildStatusTick.fainted) {
      skipWildAttack = true
    }
  }

  // Wild attacks the incoming creature (no player attack — this is a switch)
  let wildDamage = 0
  let playerTookDamage = false
  if (wildHpRemaining > 0 && !skipWildAttack && playerHpRemaining > 0) {
    wildDamage = calculateFightDamage(wildCreature.atk)
    playerTookDamage = true
    playerHpRemaining = Math.max(0, playerHpRemaining - wildDamage)
  }

  // Wild's status effect may proc on the new active creature
  let statusAppliedToPlayer: StatusEffect | null = null
  let playerNewStatusTurns = 0
  let newPlayerStatus: StatusEffect | null = newPlayerStatusBefore
  let newPlayerStatusTurns = 0
  if (wildDamage > 0) {
    const triggered = rollStatusEffect(
      wildCreature.status_effect as StatusEffect | null,
      wildCreature.status_effect_chance,
    )
    if (triggered) {
      statusAppliedToPlayer = triggered
      playerNewStatusTurns = STATUS_EFFECT_META[triggered].turns
      newPlayerStatus = triggered
      newPlayerStatusTurns = playerNewStatusTurns
    }
  }

  // Encounter remains active — switching does not flee or catch the wild
  const fightResult: 'ongoing' | 'fled' = wildHpRemaining === 0 ? 'fled' : 'ongoing'
  const catchMultiplier = getCatchHealthMultiplier(wildHpRemaining, wildCreature.hp)

  await supabase
    .from('encounters')
    .update({
      wild_creature_hp: wildHpRemaining,
      status: fightResult === 'fled' ? 'fought' : 'active',
      resolved_at: fightResult === 'fled' ? new Date().toISOString() : null,
      wild_status: fightResult === 'fled' ? null : newWildStatus,
      wild_status_turns: fightResult === 'fled' ? 0 : newWildStatusTurns,
      // Player status resets — new creature comes in clean (then maybe gets statusAppliedToPlayer)
      player_status: fightResult === 'fled' ? null : newPlayerStatus,
      player_status_turns: fightResult === 'fled' ? 0 : newPlayerStatusTurns,
    })
    .eq('id', encounterId)

  return NextResponse.json({
    wildHpRemaining,
    wildHpMax: wildCreature.hp,
    playerHpRemaining,
    playerDamage: 0,
    wildDamage,
    playerTookDamage,
    playerFaintedFromStatus: false,
    elementMultiplier: 1,
    playerCrit: false,
    fightResult,
    catchMultiplier,
    levelUp: null,
    statusEvents,
    statusAppliedToWild: null,
    wildNewStatusTurns: 0,
    statusAppliedToPlayer,
    playerNewStatusTurns,
    skipPlayerAttack: true,
  })
}
