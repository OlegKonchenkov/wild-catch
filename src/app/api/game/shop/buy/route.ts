import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { itemId, sessionId, quantity = 1 } = body

  if (!itemId || !sessionId) {
    return NextResponse.json({ error: 'itemId e sessionId richiesti' }, { status: 400 })
  }

  // Get item price
  const { data: item } = await supabase
    .from('items')
    .select('id, name, shop_price')
    .eq('id', itemId)
    .single()

  if (!item) return NextResponse.json({ error: 'Oggetto non trovato' }, { status: 404 })

  const totalCost = item.shop_price * quantity

  // Get player gold
  const { data: ps } = await supabase
    .from('player_sessions')
    .select('id, gold')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!ps) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  if (ps.gold < totalCost) return NextResponse.json({ error: 'Oro insufficiente' }, { status: 402 })

  // Atomic: deduct gold + add item
  const { error: goldError } = await supabase
    .from('player_sessions')
    .update({ gold: ps.gold - totalCost })
    .eq('id', ps.id)
    .eq('gold', ps.gold)  // optimistic lock

  if (goldError) return NextResponse.json({ error: 'Errore transazione' }, { status: 500 })

  // Add item to inventory (upsert)
  const { data: existing } = await supabase
    .from('player_inventory')
    .select('id, quantity')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('item_id', itemId)
    .single()

  if (existing) {
    await supabase.from('player_inventory')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id)
  } else {
    await supabase.from('player_inventory').insert({
      user_id: user.id, session_id: sessionId, item_id: itemId, quantity,
    })
  }

  return NextResponse.json({
    success: true,
    remainingGold: ps.gold - totalCost,
    itemName: item.name,
    quantity,
  })
}
