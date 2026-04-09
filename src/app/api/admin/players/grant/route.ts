import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

// POST /api/admin/players/grant
// Body: { userId, sessionId, type: 'gold'|'exp'|'item', amount?, itemId?, quantity? }
export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const body = await request.json().catch(() => ({}))
  const { userId, sessionId, type, amount, itemId, quantity, creatureId } = body

  if (!userId || !sessionId || !type) {
    return NextResponse.json({ error: 'userId, sessionId e type richiesti' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Guard: session must still be active
  const { data: sessionCheck } = await admin.from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'La sessione è terminata' }, { status: 403 })
  }

  if (type === 'gold') {
    const goldAmount = Number(amount)
    if (!goldAmount || goldAmount === 0) return NextResponse.json({ error: 'Importo non valido' }, { status: 400 })
    const { data: ps } = await admin
      .from('player_sessions')
      .select('gold')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single()
    if (!ps) return NextResponse.json({ error: 'Giocatore non trovato' }, { status: 404 })
    const newGold = Math.max(0, (ps.gold ?? 0) + goldAmount)
    const { error } = await admin
      .from('player_sessions')
      .update({ gold: newGold })
      .eq('user_id', userId)
      .eq('session_id', sessionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ granted: true, type, amount: goldAmount, newValue: newGold })
  }

  if (type === 'exp') {
    const expAmount = Number(amount)
    if (!expAmount || expAmount === 0) return NextResponse.json({ error: 'XP non valido' }, { status: 400 })
    const { data: rpcData, error } = await admin.rpc('increment_player_stats', {
      p_user_id: userId,
      p_session_id: sessionId,
      p_exp: expAmount,
      p_score: 0,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const row = Array.isArray(rpcData) ? rpcData[0] : null
    return NextResponse.json({
      granted: true, type, amount: expAmount,
      levelUp: row?.leveled_up ? { newLevel: row.new_level } : null,
    })
  }

  if (type === 'item') {
    const qty = Number(quantity) || 1
    if (!itemId) return NextResponse.json({ error: 'itemId richiesto' }, { status: 400 })

    // Check if player already has this item
    const { data: existing } = await admin
      .from('player_inventory')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('item_id', itemId)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('player_inventory')
        .update({ quantity: existing.quantity + qty })
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await admin.from('player_inventory').insert({
        user_id: userId, session_id: sessionId, item_id: itemId, quantity: qty,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ granted: true, type, itemId, quantity: qty })
  }

  if (type === 'creature') {
    if (!creatureId) return NextResponse.json({ error: 'creatureId richiesto' }, { status: 400 })
    const { data: existing } = await admin
      .from('player_creatures')
      .select('id, duplicates_count')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('creature_id', creatureId)
      .maybeSingle()
    if (existing) {
      await admin.from('player_creatures')
        .update({ duplicates_count: existing.duplicates_count + 1 })
        .eq('id', existing.id)
    } else {
      const { error } = await admin.from('player_creatures').insert({
        user_id: userId, session_id: sessionId, creature_id: creatureId, duplicates_count: 1,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ granted: true, type, creatureId })
  }

  return NextResponse.json({ error: 'Tipo non valido (gold|exp|item|creature)' }, { status: 400 })
}
