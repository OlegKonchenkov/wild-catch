import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { isEquipmentSlot } from '@/lib/game/equipment'

async function ensureSessionActive(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string) {
  const { data: s } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
  if (!s) return 'Sessione non trovata'
  if (s.status !== 'active') {
    const notStarted = s.status === 'draft' || s.status === 'ready'
    return notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
  }
  return null
}

/** Return an item to the player's inventory (increment existing row or create it). */
async function giveBackToInventory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string,
  itemId: string,
) {
  const { data: row } = await supabase
    .from('player_inventory')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .eq('item_id', itemId)
    .maybeSingle()

  if (row) {
    await supabase
      .from('player_inventory')
      .update({ quantity: (row.quantity ?? 0) + 1 })
      .eq('id', row.id)
  } else {
    await supabase
      .from('player_inventory')
      .insert({ user_id: userId, session_id: sessionId, item_id: itemId, quantity: 1 })
  }
}

// GET ?playerCreatureId= → equipped pieces for one owned creature
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const playerCreatureId = new URL(request.url).searchParams.get('playerCreatureId')
  if (!playerCreatureId) return NextResponse.json({ error: 'playerCreatureId mancante' }, { status: 400 })

  const { data } = await supabase
    .from('creature_equipment')
    .select('slot, item_id, items(id, name, type, description, image_url, rarity, bonus_hp, bonus_atk, bonus_def)')
    .eq('user_id', user.id)
    .eq('player_creature_id', playerCreatureId)

  return NextResponse.json({ equipment: data ?? [] })
}

// POST → equip an item into a slot (replaces any existing piece in that slot)
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, playerCreatureId, slot, itemId } = await request.json()
  if (!sessionId || !playerCreatureId || !slot || !itemId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }
  if (!isEquipmentSlot(slot)) {
    return NextResponse.json({ error: 'Slot non valido' }, { status: 400 })
  }

  const sessionErr = await ensureSessionActive(supabase, sessionId)
  if (sessionErr) return NextResponse.json({ error: sessionErr }, { status: 403 })

  // Owned creature must belong to this user in this session
  const { data: pc } = await supabase
    .from('player_creatures')
    .select('id')
    .eq('id', playerCreatureId)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!pc) return NextResponse.json({ error: 'Creatura non valida per questa sessione' }, { status: 404 })

  // Inventory row must exist, have stock, and the item type must match the slot
  const { data: inv } = await supabase
    .from('player_inventory')
    .select('id, quantity, items(id, type)')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('item_id', itemId)
    .maybeSingle()

  const invRow = inv as { id: string; quantity: number; items: { id: string; type: string } | null } | null
  if (!invRow || invRow.quantity <= 0) {
    return NextResponse.json({ error: 'Oggetto non disponibile nello zaino' }, { status: 400 })
  }
  if (invRow.items?.type !== slot) {
    return NextResponse.json({ error: 'Questo oggetto non va in questo slot' }, { status: 400 })
  }

  // If the slot is already taken, return the old piece to the inventory first
  const { data: existing } = await supabase
    .from('creature_equipment')
    .select('id, item_id')
    .eq('player_creature_id', playerCreatureId)
    .eq('slot', slot)
    .maybeSingle()

  if (existing) {
    await giveBackToInventory(supabase, user.id, sessionId, existing.item_id)
    await supabase.from('creature_equipment').delete().eq('id', existing.id)
  }

  await supabase
    .from('player_inventory')
    .update({ quantity: invRow.quantity - 1 })
    .eq('id', invRow.id)

  await supabase.from('creature_equipment').insert({
    user_id: user.id,
    session_id: sessionId,
    player_creature_id: playerCreatureId,
    slot,
    item_id: itemId,
  })

  return NextResponse.json({ ok: true, slot, itemId })
}

// DELETE → unequip a slot and return the piece to the inventory
export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, playerCreatureId, slot } = await request.json()
  if (!sessionId || !playerCreatureId || !slot) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }
  if (!isEquipmentSlot(slot)) {
    return NextResponse.json({ error: 'Slot non valido' }, { status: 400 })
  }

  const sessionErr = await ensureSessionActive(supabase, sessionId)
  if (sessionErr) return NextResponse.json({ error: sessionErr }, { status: 403 })

  const { data: existing } = await supabase
    .from('creature_equipment')
    .select('id, item_id')
    .eq('user_id', user.id)
    .eq('player_creature_id', playerCreatureId)
    .eq('slot', slot)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Slot già vuoto' }, { status: 400 })

  await giveBackToInventory(supabase, user.id, sessionId, existing.item_id)
  await supabase.from('creature_equipment').delete().eq('id', existing.id)

  return NextResponse.json({ ok: true, slot })
}
