import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateFightDamage, getCatchHealthMultiplier } from '@/lib/game/rng'
import { RARITY_CATCH_RATES, CATCH_DIFFICULTY_MULT } from '@/lib/types'
import { incrementMissionProgress } from '@/lib/game/missions'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { encounterId, itemId } = body

  if (!encounterId) return NextResponse.json({ error: 'encounterId mancante' }, { status: 400 })

  // Get active encounter
  const { data: encounter } = await supabase
    .from('encounters')
    .select('*, creatures(*)')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!encounter) return NextResponse.json({ error: 'Incontro non trovato o già concluso' }, { status: 404 })

  // Guard: session must still be active
  const { data: sessionCheck } = await supabase.from('sessions').select('status').eq('id', encounter.session_id).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    const notStarted = sessionCheck?.status === 'draft' || sessionCheck?.status === 'ready'
    const errMsg = notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
    return NextResponse.json({ error: errMsg }, { status: 403 })
  }

  const creature = (encounter as any).creatures

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
    if (inv && inv.quantity > 0 && (inv.items?.type === 'rete' || inv.items?.type === 'esca')) {
      itemMult = Number(inv.items.effect_value ?? 1)
      await supabase
        .from('player_inventory')
        .update({ quantity: inv.quantity - 1 })
        .eq('id', itemId)
    }
  }

  // HP weakness multiplier × item multiplier — both scale the base catch rate
  const hpMultiplier = getCatchHealthMultiplier(encounter.wild_creature_hp, creature.hp) * itemMult

  // Fetch player level and global catch config in parallel
  const { createAdminClient: adminFactory } = await import('@/lib/supabase/admin')
  const adminCatch = adminFactory()
  const [psResult, cfgResult] = await Promise.all([
    supabase.from('player_sessions').select('level, gold').eq('user_id', user.id).eq('session_id', encounter.session_id).single(),
    adminCatch.from('global_catch_config').select('*').eq('id', 1).maybeSingle(),
  ])
  const playerLevel  = (psResult.data as any)?.level ?? 1
  const currentGold  = (psResult.data as any)?.gold  ?? 0
  const cfg = cfgResult.data

  // Base catch rate: DB config overrides hardcoded defaults if present
  const rarity = creature.rarity as string
  const baseRate: number = cfg
    ? (cfg[`${rarity}_rate`] ?? RARITY_CATCH_RATES[rarity as keyof typeof RARITY_CATCH_RATES] ?? 0.10)
    : (RARITY_CATCH_RATES[rarity as keyof typeof RARITY_CATCH_RATES] ?? 0.10)

  // Level bonus: +X catch probability per level (0 by default = no scaling)
  const levelBonus: number = cfg ? ((cfg[`${rarity}_level_bonus`] ?? 0) * playerLevel) : 0

  const diffMult = CATCH_DIFFICULTY_MULT[creature.catch_difficulty ?? 3] ?? 1.0
  const catchRate = Math.min(1.0, baseRate * diffMult * hpMultiplier + levelBonus)
  const caught = Math.random() < catchRate

  if (!caught) {
    // 40% chance the creature flees immediately, 60% chance it counter-attacks and stays
    const flees = Math.random() < 0.40
    if (flees) {
      await supabase
        .from('encounters')
        .update({ status: 'fled', resolved_at: new Date().toISOString() })
        .eq('id', encounterId)
      return NextResponse.json({ caught: false, fled: true, wildDamage: 0 })
    } else {
      // Counter-attack: encounter stays active
      const counterDamage = calculateFightDamage(creature.atk)
      return NextResponse.json({ caught: false, fled: false, wildDamage: counterDamage })
    }
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

  if (existing) {
    const newCount = existing.duplicates_count + 1

    if (newCount >= 3 && !existing.evolved) {
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
    await supabase.from('player_creatures').upsert({
      user_id: user.id,
      creature_id: creature.id,
      session_id: encounter.session_id,
      duplicates_count: 1,
    }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
  }

  // Award EXP, gold and score — new catch=15, duplicate=5
  const rarityMultiplier = { comune: 1, non_comune: 2, raro: 3, epico: 4, leggendario: 5, mitologico: 6 }
  const rarityMult = rarityMultiplier[creature.rarity as keyof typeof rarityMultiplier] ?? 1
  const expGain   = existing ? 5  : 15
  const goldGain  = expGain   // gold mirrors EXP
  const scoreGain = existing ? 5  : 15 * rarityMult

  const [{ data: rpcData }] = await Promise.all([
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

  const rpcRow    = Array.isArray(rpcData) ? rpcData[0] : null
  const levelUp   = rpcRow?.leveled_up
    ? { newLevel: rpcRow.new_level, goldReward: rpcRow.gold_reward ?? 0 }
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
  }
  adminEvt.from('player_game_events').insert({
    user_id: user.id,
    session_id: encounter.session_id,
    type: 'catch',
    payload: {
      creature_name: creature.name,
      rarity: creature.rarity,
      element: creature.element,
      evolved: evolvedTriggered,
      gold: goldGain,
    },
  }).then(undefined, () => {})

  return NextResponse.json({ caught: true, evolved: evolvedTriggered, newCreatureId, expGain, goldGain, scoreGain, levelUp, completedMissions })
}

