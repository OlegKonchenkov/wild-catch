import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { getGlobalCatchConfig } from '@/lib/game/config-cache'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getCatchHealthMultiplier } from '@/lib/game/rng'
import { RARITY_CATCH_RATES, CATCH_DIFFICULTY_MULT } from '@/lib/types'
import { incrementMissionProgress } from '@/lib/game/missions'
import { grantLevelRewards } from '@/lib/game/level-rewards'
import { sendPushToUser, getDisplayName, pickOne } from '@/lib/push'
import { logSessionError } from '@/lib/logSessionError'
import { calculateCombatDamage } from '@/lib/game/combat'
import { eventBonusMultiplier } from '@/lib/game/event-bonuses'
import { getEquipmentBonuses } from '@/lib/game/equipment'
import type { StatusEffect } from '@/lib/game/combat'

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('encounter_act', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const body = await request.json().catch(() => ({}))
  const { encounterId, itemId } = body

  if (!encounterId) return NextResponse.json({ error: 'encounterId mancante' }, { status: 400 })

  // One round-trip: encounter + wild creature + parent session status.
  const { data: encounter } = await supabase
    .from('encounters')
    .select('*, creatures(*), sessions(status)')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!encounter) return NextResponse.json({ error: 'Incontro non trovato o già concluso' }, { status: 404 })

  // Guard: session must still be active
  const sessionStatus = (encounter as any).sessions?.status
  if (sessionStatus !== 'active') {
    const notStarted = sessionStatus === 'draft' || sessionStatus === 'ready'
    const errMsg = notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
    return NextResponse.json({ error: errMsg }, { status: 403 })
  }

  const creature = (encounter as any).creatures
  const wildStatus = (encounter as any).wild_status as StatusEffect | null

  // Tick wild status on every catch attempt (one player action = one turn)
  // veleno has turns=0 (permanent) and is handled only during fight turns; skip it.
  const wildStatusTurnsNow = (encounter as any).wild_status_turns ?? 0
  let newWildStatus: StatusEffect | null = wildStatus
  let newWildStatusTurns = wildStatusTurnsNow
  if (newWildStatus && newWildStatus !== 'veleno' && newWildStatusTurns > 0) {
    newWildStatusTurns = Math.max(0, newWildStatusTurns - 1)
    if (newWildStatusTurns <= 0) newWildStatus = null
  }

  // Get item multiplier from effect_value (rete/esca stored as decimal, e.g. 2.0 = ×2)
  let itemMult = 1
  if (itemId) {
    const { data: invItem } = await supabase
      .from('player_inventory')
      .select('quantity, items(type, effect_value)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single()

    const inv = invItem as { quantity: number; items: { type: string; effect_value: number } } | null
    // Only "rete" items boost the catch attempt directly. "esca" is a
    // PASSIVE spawn-rate booster activated separately via
    // /api/game/item/use — accepting it here was a long-standing bug
    // that turned every Esca's effect_value into a catch multiplier,
    // letting players cheese leggendaries.
    if (inv && inv.quantity > 0 && inv.items?.type === 'rete') {
      itemMult = Number(inv.items.effect_value ?? 1)
      await supabase
        .from('player_inventory')
        .update({ quantity: inv.quantity - 1 })
        .eq('id', itemId)
    }
  }

  // HP weakness multiplier × item multiplier — both scale the base catch rate
  const hpMultiplier = getCatchHealthMultiplier(encounter.wild_creature_hp, creature.hp) * itemMult

  // Status effect catch multiplier: sleeping ×2, paralyzed/confused ×1.5
  const statusCatchMult = wildStatus === 'sonno' ? 2.0
    : (wildStatus === 'paralisi' || wildStatus === 'confusione') ? 1.5
    : 1.0

  // Player level (per-user) + global catch config (cached, ~zero-cost re-reads).
  const [psResult, cfg] = await Promise.all([
    supabase.from('player_sessions').select('level, gold, squad_ids, event_bonuses').eq('user_id', user.id).eq('session_id', encounter.session_id).single(),
    getGlobalCatchConfig(),
  ])
  const playerLevel  = (psResult.data as any)?.level ?? 1
  const currentGold  = (psResult.data as any)?.gold  ?? 0
  const squadIds: string[] = ((psResult.data as any)?.squad_ids ?? []) as string[]

  // Base catch rate: DB config overrides hardcoded defaults if present
  const rarity = creature.rarity as string
  // Dynamic per-rarity column access (comune_rate, raro_rate, ...). The columns
  // are all numeric; cast to an indexable record for the template-literal key.
  const cfgRec = cfg as Record<string, number> | null
  const baseRate: number = cfgRec
    ? (cfgRec[`${rarity}_rate`] ?? RARITY_CATCH_RATES[rarity as keyof typeof RARITY_CATCH_RATES] ?? 0.10)
    : (RARITY_CATCH_RATES[rarity as keyof typeof RARITY_CATCH_RATES] ?? 0.10)

  // Level bonus: +X catch probability per level (0 by default = no scaling)
  const levelBonus: number = cfgRec ? ((cfgRec[`${rarity}_level_bonus`] ?? 0) * playerLevel) : 0

  const diffMult = CATCH_DIFFICULTY_MULT[creature.catch_difficulty ?? 3] ?? 1.0
  const catchRate = Math.min(1.0, baseRate * diffMult * hpMultiplier * statusCatchMult + levelBonus)
  const caught = Math.random() < catchRate

  // Helper: persist ticked status when encounter stays active
  const persistTickedStatus = () => supabase
    .from('encounters')
    .update({ wild_status: newWildStatus, wild_status_turns: newWildStatusTurns })
    .eq('id', encounterId)

  const statusPayload = { wildStatus: newWildStatus, wildStatusTurns: newWildStatusTurns }

  // The wild's counter-attack is mitigated by the active creature's DEF, the
  // same way /fight and /switch now do it — otherwise a failed catch attempt
  // would hit harder than a lost fight round against the same creature, and
  // defensive gear would go on being a dead stat.
  //
  // Loaded lazily: a successful catch never counter-attacks, so the common
  // path doesn't pay for these two lookups.
  let cachedPlayerDef: number | null = null
  const resolvePlayerDef = async (): Promise<number> => {
    if (cachedPlayerDef !== null) return cachedPlayerDef
    cachedPlayerDef = 0
    const pcId = encounter.player_creature_id
    if (!pcId) return cachedPlayerDef
    const [{ data: pc }, equipMap] = await Promise.all([
      supabase.from('player_creatures').select('creatures(def)').eq('id', pcId).maybeSingle(),
      getEquipmentBonuses(supabase, [pcId]),
    ])
    const baseDef = (pc as { creatures?: { def?: number } } | null)?.creatures?.def ?? 0
    cachedPlayerDef = baseDef + (equipMap.get(pcId)?.def ?? 0)
    return cachedPlayerDef
  }
  const counterAttack = async () => calculateCombatDamage({
    attackerAtk: creature.atk,
    defenderDef: await resolvePlayerDef(),
  })

  if (!caught) {
    // Sleeping: can't flee or counter-attack
    if (wildStatus === 'sonno') {
      await persistTickedStatus()
      return NextResponse.json({ caught: false, fled: false, wildDamage: 0, ...statusPayload })
    }

    // Paralysed: can't flee, but 35% chance it still counter-attacks
    if (wildStatus === 'paralisi') {
      if (Math.random() < 0.65) {
        await persistTickedStatus()
        return NextResponse.json({ caught: false, fled: false, wildDamage: 0, ...statusPayload })
      }
      const counterDamage = await counterAttack()
      await persistTickedStatus()
      return NextResponse.json({ caught: false, fled: false, wildDamage: counterDamage, ...statusPayload })
    }

    // 30% chance the creature flees (confused creatures still flee)
    const flees = Math.random() < 0.30
    if (flees) {
      await supabase
        .from('encounters')
        .update({ status: 'fled', resolved_at: new Date().toISOString() })
        .eq('id', encounterId)
      return NextResponse.json({ caught: false, fled: true, wildDamage: 0 })
    }

    // Counter-attack: confused creatures have 50% chance of skipping; tick status
    if (wildStatus === 'confusione' && Math.random() < 0.5) {
      await persistTickedStatus()
      return NextResponse.json({ caught: false, fled: false, wildDamage: 0, ...statusPayload })
    }

    const counterDamage = await counterAttack()
    await persistTickedStatus()
    return NextResponse.json({ caught: false, fled: false, wildDamage: counterDamage, ...statusPayload })
  }

  await supabase
    .from('encounters')
    .update({ status: 'caught', resolved_at: new Date().toISOString() })
    .eq('id', encounterId)

  // Check for existing duplicate
  const { data: existing } = await supabase
    .from('player_creatures')
    .select('id, duplicates_count, evolved')
    .eq('user_id', user.id)
    .eq('creature_id', creature.id)
    .eq('session_id', encounter.session_id)
    .maybeSingle()

  let evolvedTriggered = false
  let newCreatureId = creature.id
  // `isNew` = the player added a creature_id that wasn't yet in their
  // session collection. Drives the bestiary "Nuovo!" reveal animation.
  // Base catch path: true when !existing. Evolution path: true when the
  // evolved form is added as a fresh row (see existingEvolved below).
  let isNew = !existing

  if (existing) {
    const newCount = existing.duplicates_count + 1

    // Auto-evolve when this catch brings the count to EXACTLY 3.
    //
    // Design rule (per game-design decision): "every 3 copies caught =
    // +1 evolution". We don't gate on `existing.evolved` — a re-evolved
    // creature is allowed. But we ONLY auto-fire on the threshold-
    // crossing catch (newCount === 3, never >= 3) to avoid a chain
    // reaction when count somehow stockpiles past 3 (e.g. via eggs,
    // missions). Players who accumulate a surplus can evolve it through
    // the manual /api/game/creature/evolve endpoint, one click = one
    // evolution.
    if (newCount === 3) {
      const { data: evolvedForm } = await supabase
        .from('creatures')
        .select('id')
        .eq('evolution_of', creature.id)
        .maybeSingle()

      if (evolvedForm) {
        // Consume 2 copies from base (always keeps ≥1), mark as evolved
        const copiesRemaining = newCount - 2
        await supabase
          .from('player_creatures')
          .update({ duplicates_count: copiesRemaining, evolved: true })
          .eq('id', existing.id)

        // Add evolved form as its own collection entry (or increment)
        const { data: existingEvolved } = await supabase
          .from('player_creatures')
          .select('id, duplicates_count')
          .eq('user_id', user.id)
          .eq('creature_id', evolvedForm.id)
          .eq('session_id', encounter.session_id)
          .maybeSingle()

        if (existingEvolved) {
          await supabase
            .from('player_creatures')
            .update({ duplicates_count: existingEvolved.duplicates_count + 1 })
            .eq('id', existingEvolved.id)
        } else {
          await supabase.from('player_creatures').upsert({
            user_id: user.id,
            creature_id: evolvedForm.id,
            session_id: encounter.session_id,
            duplicates_count: 1,
          }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
          // First-time evolved form → bestiary should reveal it.
          isNew = true
        }

        evolvedTriggered = true
        newCreatureId = evolvedForm.id
      } else {
        // No evolution available — just update count
        await supabase
          .from('player_creatures')
          .update({ duplicates_count: newCount })
          .eq('id', existing.id)
      }
    } else {
      await supabase
        .from('player_creatures')
        .update({ duplicates_count: newCount })
        .eq('id', existing.id)
    }
  } else {
    // ignoreDuplicates guards against the rare concurrent-catch race condition
    const { error: grantErr } = await supabase.from('player_creatures').upsert({
      user_id: user.id,
      creature_id: creature.id,
      session_id: encounter.session_id,
      duplicates_count: 1,
    }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
    // The grant is the player's reward; if it silently fails they'd see
    // "caught!" without the creature. Surface it for observability.
    if (grantErr) {
      logSessionError({
        sessionId: encounter.session_id, userId: user.id, source: 'encounter_catch',
        errorCode: 'server_error',
        message: `Creatura catturata ma non salvata: ${grantErr.message}`,
        context: { creatureId: creature.id, encounterId },
      })
    }
  }

  // Auto-fill a free squad slot with a newly-caught creature (up to 3). Early
  // players build a full squad without opening the DaimonDex — we only ever
  // fill EMPTY slots, never replace an existing pick. Plain new catches only
  // (evolutions stay a manual squad choice).
  // 1-based squad slot the catch landed in, or null when nothing was auto-added.
  // Returned to the client so the catch screen can TELL the player it happened
  // instead of silently rearranging their squad behind their back.
  let addedToSquadSlot: number | null = null
  if (!existing && squadIds.length < 3) {
    const { data: caughtPc } = await supabase
      .from('player_creatures')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_id', encounter.session_id)
      .eq('creature_id', creature.id)
      .maybeSingle()
    if (caughtPc?.id && !squadIds.includes(caughtPc.id)) {
      const nextSquad = [...squadIds, caughtPc.id]
      const squadUpdate: Record<string, unknown> = { squad_ids: nextSquad }
      // Slot 0 is the primary fighter — mirror the squad route's behaviour.
      if (nextSquad.length === 1) squadUpdate.selected_creature_id = caughtPc.id
      const { error: squadErr } = await supabase
        .from('player_sessions')
        .update(squadUpdate)
        .eq('user_id', user.id)
        .eq('session_id', encounter.session_id)
      if (!squadErr) addedToSquadSlot = nextSquad.length
    }
  }

  // Award EXP, gold and score. Base is 15 for a new catch, 5 for a duplicate,
  // scaled by rarity on all three axes.
  //
  // EXP/gold used to be flat (15 / 5 regardless of rarity) while only `score`
  // scaled with rarity. That inverted the incentive of the whole loop: a
  // mitologico at a 1.25% base catch rate paid the same 15 exp as a comune at
  // 70%, making comune farming ~56× more efficient per attempt. Chasing rare
  // Daimon has to pay for the hunt to mean anything.
  const rarityMultiplier = { comune: 1, non_comune: 2, raro: 3, epico: 4, leggendario: 5, mitologico: 6 }
  const rarityMult = rarityMultiplier[creature.rarity as keyof typeof rarityMultiplier] ?? 1
  const baseGain  = existing ? 5 : 15
  // Timed `evento` bonuses (double EXP / gold rain) granted by a pin or QR.
  // These were authorable but never applied to anything — see migration 081.
  const eventBonuses = psResult.data?.event_bonuses
  const expBonusMult  = eventBonusMultiplier(eventBonuses, 'exp_boost')
  const goldBonusMult = eventBonusMultiplier(eventBonuses, 'gold_rain')
  const expGain   = Math.round(baseGain * rarityMult * expBonusMult)
  const goldGain  = Math.round(baseGain * rarityMult * goldBonusMult)
  // Score keeps its original shape on purpose: duplicates stay worth a flat 5
  // so the leaderboard rewards breadth of collection, not repeat farming.
  const scoreGain = existing ? 5  : 15 * rarityMult

  const [{ data: rpcData }, { error: goldErr }] = await Promise.all([
    supabase.rpc('increment_player_stats', {
      p_user_id: user.id,
      p_session_id: encounter.session_id,
      p_exp: expGain,
      p_score: scoreGain,
    }),
    supabase.from('player_sessions')
      .update({ gold: currentGold + goldGain })
      .eq('user_id', user.id)
      .eq('session_id', encounter.session_id),
  ])
  if (goldErr) {
    logSessionError({
      sessionId: encounter.session_id, userId: user.id, source: 'encounter_catch',
      errorCode: 'server_error',
      message: `Oro non aggiornato dopo cattura: ${goldErr.message}`,
      context: { encounterId, goldGain },
    })
  }

  const rpcRow    = Array.isArray(rpcData) ? rpcData[0] : null
  const levelUp   = rpcRow?.leveled_up
    ? {
        newLevel: rpcRow.new_level,
        goldReward: rpcRow.gold_reward ?? 0,
        rewards: await grantLevelRewards(supabase, user.id, encounter.session_id, rpcRow.new_level),
      }
    : null

  // Track cattura missions — await so we can return completion data to client
  const completedMissions = await incrementMissionProgress({
    type: 'cattura',
    target: creature.name,
    userId: user.id,
    sessionId: encounter.session_id,
  }).catch(() => [])

  // Save game event for bell history
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminEvt = createAdminClient()
  if (levelUp) {
    adminEvt.from('player_game_events').insert({
      user_id: user.id,
      session_id: encounter.session_id,
      type: 'level_up',
      payload: { new_level: levelUp.newLevel, gold_reward: levelUp.goldReward },
    }).then(undefined, () => {})
    after(async () => {
      const nick = await getDisplayName(user.id)
      const who = nick ? `${nick}, ` : ''
      const title = pickOne([
        `🎉 Livello ${levelUp.newLevel}!`,
        `⭐ Salita di livello!`,
        `✨ Sei più forte!`,
      ])
      const reward = levelUp.goldReward ? ` Ti sono piovuti ${levelUp.goldReward} 🪙.` : ''
      const body = pickOne([
        `${who}sei arrivato al livello ${levelUp.newLevel}.${reward} Le tue creature ringraziano.`,
        `${who}livello ${levelUp.newLevel} sbloccato.${reward} Avanti così, Domatore!`,
        `${who}ora sei livello ${levelUp.newLevel}.${reward} Nuove sfide ti aspettano.`,
      ])
      await sendPushToUser(user.id, { title, body, url: '/game/map', tag: 'level_up' })
    })
  }
  adminEvt.from('player_game_events').insert({
    user_id: user.id,
    session_id: encounter.session_id,
    type: 'catch',
    payload: {
      creature_name:    creature.name,
      rarity:           creature.rarity,
      element:          creature.element,
      evolved:          evolvedTriggered,
      gold:             goldGain,
      image_url:        creature.sprite_cutout_url || creature.sprite_url || creature.image_url || null,
      hp:               creature.hp  ?? null,
      atk:              creature.atk ?? null,
      def:              creature.def ?? null,
      catch_difficulty: creature.catch_difficulty ?? null,
    },
  }).then(undefined, () => {})

  return NextResponse.json({ caught: true, evolved: evolvedTriggered, isNew, newCreatureId, expGain, goldGain, scoreGain, levelUp, completedMissions, addedToSquadSlot })
}

