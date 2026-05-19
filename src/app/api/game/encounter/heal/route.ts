import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getEquipmentBonuses } from '@/lib/game/equipment'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('encounter_act', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const { encounterId, itemId } = await request.json().catch(() => ({}))

  if (!encounterId || !itemId) {
    return NextResponse.json({ error: 'encounterId e itemId richiesti' }, { status: 400 })
  }

  // Validate encounter is active and belongs to user
  const { data: encounter } = await supabase
    .from('encounters')
    .select('id, player_creature_id, session_id, player_hp')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!encounter) return NextResponse.json({ error: 'Incontro non trovato o già concluso' }, { status: 404 })
  if (!encounter.player_creature_id) {
    return NextResponse.json({ error: 'Nessuna creatura selezionata' }, { status: 400 })
  }

  // Validate heal item in inventory
  const { data: invItem } = await supabase
    .from('player_inventory')
    .select('id, quantity, items(id, effect_value, type)')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .eq('session_id', encounter.session_id)
    .single()

  const inv = invItem as { id: string; quantity: number; items: { id: string; effect_value: number; type: string } } | null

  if (!inv || inv.quantity <= 0) {
    return NextResponse.json({ error: 'Oggetto non disponibile' }, { status: 400 })
  }
  if (inv.items?.type !== 'cura') {
    return NextResponse.json({ error: 'Questo oggetto non è una pozione di cura' }, { status: 400 })
  }

  // Get player creature max HP
  const { data: pc } = await supabase
    .from('player_creatures')
    .select('creatures(hp)')
    .eq('id', encounter.player_creature_id)
    .single()

  const equipBonus = (await getEquipmentBonuses(supabase, [encounter.player_creature_id])).get(encounter.player_creature_id)
    ?? { hp: 0, atk: 0, def: 0 }
  const maxHp: number = ((pc as any)?.creatures?.hp ?? 100) + equipBonus.hp
  const rawHealAmount = Math.round(maxHp * (inv.items.effect_value / 100))

  // Update server-side HP authoritatively (migration 037+). The actual
  // applied heal may be clamped to maxHp - currentHp so we don't waste
  // overflow. For legacy encounters (player_hp IS NULL) the server
  // hasn't been tracking HP, so we accept any reasonable heal value
  // and let the client manage display state.
  const serverHp = (encounter as any).player_hp as number | null
  let appliedHeal = rawHealAmount
  if (typeof serverHp === 'number') {
    const newHp = Math.min(maxHp, Math.max(0, serverHp) + rawHealAmount)
    appliedHeal = newHp - Math.max(0, serverHp)
    await supabase
      .from('encounters')
      .update({ player_hp: newHp })
      .eq('id', encounterId)
  }

  // Consume the item (only after the HP update succeeds — if the player
  // is at full HP and serverHp tracking is active, appliedHeal may be 0
  // but we still consume the item, matching long-standing behaviour).
  await supabase
    .from('player_inventory')
    .update({ quantity: inv.quantity - 1 })
    .eq('id', itemId)

  return NextResponse.json({ healed: true, healAmount: rawHealAmount, appliedHeal, maxHp })
}
