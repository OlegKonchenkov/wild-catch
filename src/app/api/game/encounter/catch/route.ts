import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rollCatch, calculateFightDamage } from '@/lib/game/rng'

const ITEM_BONUSES: Record<string, number> = {
  'Rete Base': 0,
  'Rete Avanzata': 0.10,
  'Rete Speciale': 0.20,
  'Rete Leggendaria': 0.35,
}

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

  const creature = (encounter as any).creatures

  // Get item bonus
  let bonus = 0
  if (itemId) {
    const { data: invItem } = await supabase
      .from('player_inventory')
      .select('quantity, items(name)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single()

    if (invItem && invItem.quantity > 0) {
      const itemName = (invItem as any).items?.name ?? ''
      bonus = ITEM_BONUSES[itemName] ?? 0
      await supabase
        .from('player_inventory')
        .update({ quantity: invItem.quantity - 1 })
        .eq('id', itemId)
    }
  }

  // HP reduction bonus: wild HP ≤ 30% → +20% catch bonus
  const hpRatio = encounter.wild_creature_hp / creature.hp
  if (hpRatio <= 0.3) bonus += 0.20

  // RNG catch — server-side only
  const caught = rollCatch(creature.rarity, bonus)

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
    await supabase
      .from('player_creatures')
      .update({ duplicates_count: newCount })
      .eq('id', existing.id)

    if (newCount >= 3 && !existing.evolved) {
      const { data: evolvedForm } = await supabase
        .from('creatures')
        .select('id')
        .eq('evolution_of', creature.id)
        .maybeSingle()

      if (evolvedForm) {
        await supabase
          .from('player_creatures')
          .update({ evolved: true, creature_id: evolvedForm.id })
          .eq('id', existing.id)
        evolvedTriggered = true
        newCreatureId = evolvedForm.id
      }
    }
  } else {
    await supabase.from('player_creatures').insert({
      user_id: user.id,
      creature_id: creature.id,
      session_id: encounter.session_id,
      duplicates_count: 1,
    })
  }

  // Award EXP and score
  const rarityMultiplier = { comune: 1, non_comune: 2, raro: 3, epico: 4, leggendario: 5 }
  const rarityMult = rarityMultiplier[creature.rarity as keyof typeof rarityMultiplier] ?? 1
  const expGain = existing ? 3 : 10
  const scoreGain = existing ? 3 : 10 * rarityMult

  await supabase.rpc('increment_player_stats', {
    p_user_id: user.id,
    p_session_id: encounter.session_id,
    p_exp: expGain,
    p_score: scoreGain,
  })

  return NextResponse.json({ caught: true, evolved: evolvedTriggered, newCreatureId, expGain, scoreGain })
}
