import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateFightDamage, getCatchHealthMultiplier } from '@/lib/game/rng'
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

  // Get encounter with creature data
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

  let wildHpRemaining = encounter.wild_creature_hp
  let playerTookDamage = false
  let playerDamage = 0
  let wildDamage = 0

  // Rara+ attacks first
  if (isRarePlus) {
    wildDamage = calculateFightDamage(wildCreature.atk)
    playerTookDamage = true
  }

  // Player attacks with element multiplier
  let elementMult = getElementMultiplier(
    playerCr.element as Element,
    wildCreature.element as Element
  )
  // REQ-INV-04: anti-weakness potion neutralises disadvantage (mult < 1 → 1)
  if (antiWeakness && elementMult < 1) elementMult = 1
  playerDamage = Math.round(calculateFightDamage(playerCr.atk) * elementMult * atkMultiplier)
  wildHpRemaining = Math.max(0, wildHpRemaining - playerDamage)

  // Non-rare attacks after player
  if (!isRarePlus && wildHpRemaining > 0) {
    wildDamage = calculateFightDamage(wildCreature.atk)
    playerTookDamage = true
  }

  // Determine outcome
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
    fightResult,
    catchMultiplier,
    levelUp: null,
  })
}
