import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { canLearnAbility, type Ability } from '@/lib/game/abilities'
import type { Element, Rarity } from '@/lib/types'

const ABILITY_COLS =
  'id, name, description, element, category, rarity, power, accuracy, target, priority, ' +
  'charge_turns, recharge_turns, cooldown, max_uses, hits_min, hits_max, status_effect, ' +
  'status_chance, self_status, heal_percent, lifesteal_percent, buff_atk, buff_def, ' +
  'debuff_atk, debuff_def, min_level, min_rarity, allowed_elements, icon_url, animation_key, sound_url, color'

async function ensureSessionActive(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string) {
  const { data: s } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
  if (!s) return 'Sessione non trovata'
  if (s.status !== 'active') {
    const notStarted = s.status === 'draft' || s.status === 'ready'
    return notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
  }
  return null
}

// GET ?playerCreatureId= → { moveset, tokens } for one owned creature
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const url = new URL(request.url)
  const playerCreatureId = url.searchParams.get('playerCreatureId')
  const sessionId = url.searchParams.get('sessionId')
  if (!playerCreatureId || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  const [movesetRes, tokensRes] = await Promise.all([
    supabase
      .from('creature_abilities')
      .select(`slot_index, ability_id, abilities(${ABILITY_COLS})`)
      .eq('user_id', user.id)
      .eq('player_creature_id', playerCreatureId)
      .order('slot_index'),
    supabase
      .from('player_abilities')
      .select(`ability_id, quantity, abilities(${ABILITY_COLS})`)
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .gt('quantity', 0),
  ])

  return NextResponse.json({
    moveset: movesetRes.data ?? [],
    tokens: tokensRes.data ?? [],
  })
}

// POST → learn an ability into a slot (0..3). Consumes one token.
// Body: { sessionId, playerCreatureId, abilityId, slotIndex }
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, playerCreatureId, abilityId, slotIndex } = await request.json()
  if (!sessionId || !playerCreatureId || !abilityId || slotIndex == null) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }
  const slot = Math.round(Number(slotIndex))
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) {
    return NextResponse.json({ error: 'Slot non valido (0–3)' }, { status: 400 })
  }

  const sessionErr = await ensureSessionActive(supabase, sessionId)
  if (sessionErr) return NextResponse.json({ error: sessionErr }, { status: 403 })

  // Owned creature (+ its species element/rarity) and the player's level.
  const [pcRes, psRes, abRes, tokenRes, knownRes] = await Promise.all([
    supabase
      .from('player_creatures')
      .select('id, creatures(element, rarity)')
      .eq('id', playerCreatureId)
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .maybeSingle(),
    supabase
      .from('player_sessions')
      .select('level')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .maybeSingle(),
    supabase.from('abilities').select(ABILITY_COLS).eq('id', abilityId).maybeSingle(),
    supabase
      .from('player_abilities')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .eq('ability_id', abilityId)
      .maybeSingle(),
    supabase
      .from('creature_abilities')
      .select('id, slot_index, ability_id')
      .eq('player_creature_id', playerCreatureId),
  ])

  const pc = pcRes.data as { id: string; creatures: { element: Element; rarity: Rarity } | null } | null
  if (!pc || !pc.creatures) return NextResponse.json({ error: 'Creatura non valida per questa sessione' }, { status: 404 })

  const ability = abRes.data as unknown as Ability | null
  if (!ability) return NextResponse.json({ error: 'Abilità inesistente' }, { status: 404 })

  const token = tokenRes.data as { id: string; quantity: number } | null
  const ownsToken = !!token && token.quantity > 0

  const level = (psRes.data?.level as number) ?? 1
  const gate = canLearnAbility({
    ability,
    element: pc.creatures.element,
    rarity: pc.creatures.rarity,
    playerLevel: level,
    ownsToken,
  })
  if (!gate.ok) return NextResponse.json({ error: gate.reason ?? 'Requisiti non soddisfatti' }, { status: 400 })

  const known = (knownRes.data ?? []) as { id: string; slot_index: number; ability_id: string }[]
  if (known.some(k => k.ability_id === abilityId)) {
    return NextResponse.json({ error: 'Questa creatura conosce già questa abilità' }, { status: 400 })
  }

  // If the target slot is occupied, overwrite it (forget the old move — no refund).
  const occupying = known.find(k => k.slot_index === slot)
  if (occupying) {
    await supabase.from('creature_abilities').delete().eq('id', occupying.id)
  }

  // Consume one token.
  const { error: tokenErr } = await supabase
    .from('player_abilities')
    .update({ quantity: token!.quantity - 1 })
    .eq('id', token!.id)
  if (tokenErr) return NextResponse.json({ error: tokenErr.message }, { status: 500 })

  const { error: insErr } = await supabase.from('creature_abilities').insert({
    user_id: user.id,
    session_id: sessionId,
    player_creature_id: playerCreatureId,
    ability_id: abilityId,
    slot_index: slot,
  })
  if (insErr) {
    // Roll back the token consumption on a failed insert.
    await supabase.from('player_abilities').update({ quantity: token!.quantity }).eq('id', token!.id)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, slotIndex: slot, abilityId })
}

// DELETE → forget the ability in a slot (no token refund).
// Body: { playerCreatureId, slotIndex }
export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { playerCreatureId, slotIndex } = await request.json()
  if (!playerCreatureId || slotIndex == null) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }
  const slot = Math.round(Number(slotIndex))

  const { data: existing } = await supabase
    .from('creature_abilities')
    .select('id')
    .eq('user_id', user.id)
    .eq('player_creature_id', playerCreatureId)
    .eq('slot_index', slot)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Slot già vuoto' }, { status: 400 })

  await supabase.from('creature_abilities').delete().eq('id', existing.id)
  return NextResponse.json({ ok: true, slotIndex: slot })
}
