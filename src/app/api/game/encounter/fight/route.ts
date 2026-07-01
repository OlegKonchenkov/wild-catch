import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { calculateFightDamage, getCatchHealthMultiplier } from '@/lib/game/rng'
import {
  resolveTurnStartStatus,
  rollStatusEffect,
  STATUS_EFFECT_META,
} from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import { getElementMultiplier } from '@/lib/game/elements'
import { getEquipmentBonuses } from '@/lib/game/equipment'
import {
  resolveAbilityCast, tickAbilityState, applyStatMods, addSelfBuffs,
  type Ability, type CastResult,
} from '@/lib/game/abilities'
import { normalizeEncounterAbilityState, clampMod } from '@/lib/game/ability-turn'
import type { Element } from '@/lib/types'
import type { Json } from '@/types/database'

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('encounter_act', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const body = await request.json().catch(() => ({}))
  const { encounterId, itemId, abilityId, activePlayerCreatureId, clearPlayerStatus, currentPlayerHp } = body

  if (!encounterId) {
    return NextResponse.json({ error: 'encounterId mancante' }, { status: 400 })
  }

  // One round-trip: encounter + wild creature + parent session status.
  const { data: encounter } = await supabase
    .from('encounters')
    .select('*, creatures(*), sessions(status)')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!encounter) {
    return NextResponse.json({ error: 'Incontro non trovato' }, { status: 404 })
  }

  const sessionStatus = (encounter as any).sessions?.status
  if (sessionStatus !== 'active') {
    const notStarted = sessionStatus === 'draft' || sessionStatus === 'ready'
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

  // Three independent reads — fan out in parallel (player creature, equipped
  // gear bonuses, optional inventory item) instead of three sequential awaits.
  const [pcRes, equipBonusesMap, invItemRes] = await Promise.all([
    supabase
      .from('player_creatures')
      .select('*, creatures(*)')
      .eq('id', lookupId)
      .eq('user_id', user.id)
      .single(),
    getEquipmentBonuses(supabase, [lookupId]),
    itemId
      ? supabase
          .from('player_inventory')
          .select('quantity, items(effect_value, type)')
          .eq('id', itemId)
          .eq('user_id', user.id)
          .single()
      : Promise.resolve({ data: null as { quantity: number; items: { effect_value: number; type: string } } | null }),
  ])

  const playerCreature = pcRes.data
  if (!playerCreature) {
    return NextResponse.json({ error: 'Creatura giocatore non trovata' }, { status: 404 })
  }

  const playerCr = (playerCreature as any).creatures

  // Equipped gear adds flat bonuses to the player creature's base stats.
  const equipBonus = equipBonusesMap.get(lookupId) ?? { hp: 0, atk: 0, def: 0 }
  const playerMaxHp = playerCr.hp + equipBonus.hp
  const playerAtk = playerCr.atk + equipBonus.atk
  const playerDef = (playerCr.def ?? 0) + equipBonus.def

  // ── Special abilities ──────────────────────────────────────────────────────
  // The player's active creature owns an AbilityBattleState (cooldowns / charge /
  // PP / self-buffs); the wild's stat mods from player debuffs are two scalars.
  const rawAbilityState = (encounter as { ability_state?: unknown }).ability_state
  const encState = normalizeEncounterAbilityState(rawAbilityState)
  // A charging move forces its own continuation regardless of what the client sent.
  const pendingId = encState.player.pending?.abilityId ?? null
  const effectiveAbilityId: string | null = pendingId ?? (abilityId ?? null)
  let castAbility: Ability | null = null
  if (effectiveAbilityId) {
    const abRes = await supabase.from('abilities').select('*').eq('id', effectiveAbilityId).maybeSingle()
    if (abRes.data) {
      if (pendingId) {
        castAbility = abRes.data as unknown as Ability // already validated when charging began
      } else {
        // A fresh cast must be a move this creature actually knows.
        const known = await supabase
          .from('creature_abilities')
          .select('ability_id')
          .eq('player_creature_id', lookupId)
          .eq('ability_id', effectiveAbilityId)
          .maybeSingle()
        if (known.data) castAbility = abRes.data as unknown as Ability
      }
    }
  }
  const abilitiesActive = rawAbilityState != null || castAbility != null

  let atkMultiplier = 1
  let antiWeakness = false
  let attackItemType: string | null = null
  let attackItemEffectValue = 0
  let attackItemQuantity = 0

  const inv = invItemRes.data as { quantity: number; items: { effect_value: number; type: string } } | null
  if (inv && inv.quantity > 0) {
    attackItemType = inv.items?.type ?? null
    attackItemEffectValue = inv.items?.effect_value ?? 0
    attackItemQuantity = inv.quantity
  }

  const wildStatus = (encounter as any).wild_status as StatusEffect | null
  const wildStatusTurns = (encounter as any).wild_status_turns ?? 0
  const playerStatus = clearPlayerStatus ? null : ((encounter as any).player_status as StatusEffect | null)
  const playerStatusTurns = clearPlayerStatus ? 0 : ((encounter as any).player_status_turns ?? 0)

  let wildHpRemaining = encounter.wild_creature_hp
  // Authoritative source for the active creature's HP, in priority order:
  //   1. encounter.player_hp (migration 037+) — never trust the client
  //   2. Number(currentPlayerHp) clamped — legacy in-flight encounters
  //   3. playerCr.hp (full) — first turn or missing data
  const serverPlayerHp = (encounter as any).player_hp
  let playerHpRemaining: number
  if (typeof serverPlayerHp === 'number') {
    playerHpRemaining = Math.max(0, Math.min(serverPlayerHp, playerMaxHp))
  } else {
    playerHpRemaining = Math.max(0, Math.min(
      Number.isFinite(currentPlayerHp) ? Number(currentPlayerHp) : playerMaxHp,
      playerMaxHp,
    ))
  }
  let playerTookDamage = false
  let playerDamage = 0
  let wildDamage = 0
  let playerFaintedFromStatus = false

  const statusEvents: Record<string, unknown>[] = []
  let newWildStatus: StatusEffect | null = wildStatus
  let newWildStatusTurns = wildStatusTurns
  let newPlayerStatus: StatusEffect | null = playerStatus
  let newPlayerStatusTurns = playerStatusTurns
  let skipPlayerAttack = false
  let skipWildAttack = false

  const playerStatusTick = resolveTurnStartStatus({
    effect: playerStatus,
    turnsLeft: playerStatusTurns,
    currentHp: playerHpRemaining,
    maxHp: playerMaxHp,
    atk: playerAtk,
    def: playerDef,
  })
  playerHpRemaining = playerStatusTick.currentHp
  newPlayerStatus = playerStatusTick.nextEffect
  newPlayerStatusTurns = playerStatusTick.nextTurnsLeft
  if (playerStatusTick.event) {
    statusEvents.push({ ...playerStatusTick.event, target: 'player' })
  }
  if (playerStatusTick.preventedAction) skipPlayerAttack = true
  if (playerStatusTick.fainted) {
    playerFaintedFromStatus = true
    skipWildAttack = true
  }

  // Tick ability cooldowns / recharge at the start of the player's turn.
  let abilityRecharging = false
  if (abilitiesActive) {
    const abTick = tickAbilityState(encState.player)
    encState.player = abTick.state
    abilityRecharging = abTick.recharging
    if (abilityRecharging) skipPlayerAttack = true
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

  let playerCrit = false
  let abilityCasting: CastResult | null = null
  let abilityAnimationKey: string | null = null
  let abilityCharging = false
  let abilityMissed = false
  let statusAppliedToWild: StatusEffect | null = null
  let wildNewStatusTurns = 0

  if (castAbility && !skipPlayerAttack && wildHpRemaining > 0) {
    // ── Special ability cast ──
    const effPlayer = applyStatMods(playerAtk, playerDef, encState.player)
    const effWildDef = Math.max(0, Math.round((wildCreature.def ?? 0) * (1 + encState.enemyDefMod)))
    const outcome = resolveAbilityCast({
      ability: castAbility,
      casterElement: playerCr.element as Element,
      targetElement: wildCreature.element as Element,
      casterAtk: effPlayer.atk,
      casterDef: effPlayer.def,
      casterMaxHp: playerMaxHp,
      casterHp: playerHpRemaining,
      casterStatus: newPlayerStatus,
      targetDef: effWildDef,
      targetStatus: newWildStatus,
      state: encState.player,
    })
    encState.player = outcome.nextState
    abilityCasting = outcome
    abilityAnimationKey = outcome.animationKey

    if (outcome.phase === 'charging') {
      abilityCharging = true
    } else if (outcome.phase === 'fired' && !outcome.missed) {
      playerDamage = outcome.totalDamage
      playerCrit = outcome.isCrit
      elementMult = outcome.elementMultiplier
      wildHpRemaining = Math.max(0, wildHpRemaining - playerDamage)
      if (outcome.healToCaster > 0) {
        playerHpRemaining = Math.min(playerMaxHp, playerHpRemaining + outcome.healToCaster)
      }
      if (outcome.statusToTarget && wildHpRemaining > 0) {
        statusAppliedToWild = outcome.statusToTarget
        wildNewStatusTurns = STATUS_EFFECT_META[outcome.statusToTarget].turns
        newWildStatus = outcome.statusToTarget
        newWildStatusTurns = wildNewStatusTurns
      }
      if (outcome.selfStatus) {
        newPlayerStatus = outcome.selfStatus
        newPlayerStatusTurns = STATUS_EFFECT_META[outcome.selfStatus].turns
      }
      encState.player = addSelfBuffs(encState.player, outcome.buffs)
      encState.enemyAtkMod = clampMod(encState.enemyAtkMod - outcome.debuffs.atk)
      encState.enemyDefMod = clampMod(encState.enemyDefMod - outcome.debuffs.def)
    } else if (outcome.phase === 'fired' && outcome.missed) {
      abilityMissed = true
    }
  } else if (!skipPlayerAttack && wildHpRemaining > 0) {
    // ── Base attack (unchanged behaviour) ──
    playerCrit = Math.random() < 0.10
    const critMult = playerCrit ? 1.75 : 1
    playerDamage = Math.round(calculateFightDamage(playerAtk) * elementMult * atkMultiplier * critMult)
    wildHpRemaining = Math.max(0, wildHpRemaining - playerDamage)

    // Innate on-hit status effect (base attacks only — abilities carry their own).
    if (playerDamage > 0 && wildHpRemaining > 0) {
      const triggered = rollStatusEffect(playerCr.status_effect as StatusEffect | null, playerCr.status_effect_chance)
      if (triggered) {
        statusAppliedToWild = triggered
        wildNewStatusTurns = STATUS_EFFECT_META[triggered].turns
        newWildStatus = triggered
        newWildStatusTurns = wildNewStatusTurns
      }
    }
  }

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

  if (wildHpRemaining > 0 && !skipWildAttack && playerHpRemaining > 0) {
    // enemyAtkMod is 0 unless the player debuffed the wild — identical to before otherwise.
    const effWildAtk = Math.max(1, Math.round(wildCreature.atk * (1 + encState.enemyAtkMod)))
    wildDamage = calculateFightDamage(effWildAtk)
    playerTookDamage = true
    playerHpRemaining = Math.max(0, playerHpRemaining - wildDamage)
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
      // Persist authoritative player HP — anti-cheat: the next fight call
      // will read this and ignore whatever currentPlayerHp the client sends.
      player_hp: playerHpRemaining,
      // Persist ability cooldown/charge/PP/buff state (null when the fight ends
      // or when abilities were never involved — keeps base-attack fights untouched).
      ability_state: (fightResult === 'fled' ? null : (abilitiesActive ? encState : rawAbilityState ?? null)) as unknown as Json,
    })
    .eq('id', encounterId)

  return NextResponse.json({
    wildHpRemaining,
    wildHpMax: wildCreature.hp,
    playerHpRemaining,
    playerDamage,
    wildDamage,
    playerTookDamage,
    playerFaintedFromStatus,
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
    // Ability feedback for the client (animation + turn messaging).
    abilityUsed: castAbility ? { id: castAbility.id, name: castAbility.name } : null,
    abilityAnimationKey,
    abilityCharging,
    abilityMissed,
    abilityHits: abilityCasting?.hits ?? 0,
    abilityHealedPlayer: abilityCasting?.healToCaster ?? 0,
  })
}
