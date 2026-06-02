import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { incrementMissionProgress } from '@/lib/game/missions'
import { logSessionError } from '@/lib/logSessionError'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { isTutorialSession } from '@/lib/game/tutorial'

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('shop_buy', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const body = await request.json().catch(() => ({}))
  const { itemId, sessionId, quantity = 1 } = body

  if (!itemId || !sessionId) {
    return NextResponse.json({ error: 'itemId e sessionId richiesti' }, { status: 400 })
  }

  // Guard: session must still be active
  const { data: sessionCheck } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    const notStarted = sessionCheck?.status === 'ready' || sessionCheck?.status === 'draft'
    const errMsg = notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
    logSessionError({
      sessionId, userId: user.id, source: 'shop',
      errorCode: notStarted ? 'session_not_started' : 'session_ended',
      message: `Tentativo acquisto: ${errMsg}`,
      context: { itemId, sessionStatus: sessionCheck?.status ?? 'missing' },
    })
    return NextResponse.json({ error: errMsg }, { status: 403 })
  }

  // Get item — must be either a global item (session_id IS NULL) or one
  // belonging to the current session. Without this scoping a tutorial-only
  // item could be bought from inside a paid event (since both share the
  // user's gold pool).
  const { data: item } = await supabase
    .from('items')
    .select('id, name, shop_price, session_id')
    .eq('id', itemId)
    .single()

  if (!item) return NextResponse.json({ error: 'Oggetto non trovato' }, { status: 404 })
  if (item.session_id != null && item.session_id !== sessionId) {
    return NextResponse.json({ error: 'Oggetto non disponibile in questa sessione' }, { status: 403 })
  }
  // Tutorial sessions are isolated: globals (session_id IS NULL) must NOT
  // be purchasable inside the tutorial shop, even though they would be in
  // a real event.
  if (isTutorialSession(sessionId) && item.session_id == null) {
    return NextResponse.json({ error: 'Oggetto non disponibile nel tutorial' }, { status: 403 })
  }

  const totalCost = item.shop_price * quantity

  // Get player gold
  const { data: ps } = await supabase
    .from('player_sessions')
    .select('id, gold')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!ps) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  if (ps.gold < totalCost) {
    logSessionError({
      sessionId, userId: user.id, source: 'shop',
      errorCode: 'insufficient_gold',
      message: `Oro insufficiente per "${item.name}"`,
      context: { itemId, itemName: item.name, have: ps.gold, need: totalCost },
    })
    return NextResponse.json({ error: 'Oro insufficiente' }, { status: 402 })
  }

  // Atomic: deduct gold + add item
  const { data: goldUpdateResult, error: goldError } = await supabase
    .from('player_sessions')
    .update({ gold: ps.gold - totalCost })
    .eq('id', ps.id)
    .eq('gold', ps.gold)  // optimistic lock
    .select('id')

  if (goldError || !goldUpdateResult || goldUpdateResult.length === 0) {
    return NextResponse.json({ error: 'Errore transazione (riprova)' }, { status: 409 })
  }

  // Add item to inventory (upsert)
  const { data: existing } = await supabase
    .from('player_inventory')
    .select('id, quantity')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('item_id', itemId)
    .single()

  if (existing) {
    const { error: invError } = await supabase.from('player_inventory')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id)
    if (invError) return NextResponse.json({ error: 'Errore aggiunta oggetto' }, { status: 500 })
  } else {
    const { error: invError } = await supabase.from('player_inventory').insert({
      user_id: user.id, session_id: sessionId, item_id: itemId, quantity,
    })
    if (invError) return NextResponse.json({ error: 'Errore aggiunta oggetto' }, { status: 500 })
  }

  const completedMissions = await incrementMissionProgress({
    type: 'collect',
    target: item.name,
    userId: user.id,
    sessionId,
  }).catch(() => [])

  return NextResponse.json({
    success: true,
    remainingGold: ps.gold - totalCost,
    itemName: item.name,
    quantity,
    completedMissions,
  })
}
