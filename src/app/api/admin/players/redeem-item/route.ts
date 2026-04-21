import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getLevelForExp } from '@/lib/game/leveling'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

// POST /api/admin/players/redeem-item
// body: { userId, sessionId, inventoryId }
export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { userId, sessionId, inventoryId } = await request.json().catch(() => ({}))
  if (!userId || !sessionId || !inventoryId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Guard: session must still be active
  const { data: sessionCheck } = await admin.from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'La sessione è terminata' }, { status: 403 })
  }

  // Fetch the inventory row + item info
  const { data: invRow } = await admin
    .from('player_inventory')
    .select('id, quantity, item_id, items(id, name, is_redeemable, reward)')
    .eq('id', inventoryId)
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .single()

  if (!invRow) return NextResponse.json({ error: 'Oggetto non trovato nell\'inventario' }, { status: 404 })

  const item = (invRow as any).items
  if (!item?.is_redeemable) {
    return NextResponse.json({ error: 'Questo oggetto non è riscattabile' }, { status: 400 })
  }

  // Consume 1 from inventory
  if (invRow.quantity <= 1) {
    await admin.from('player_inventory').delete().eq('id', inventoryId)
  } else {
    await admin.from('player_inventory').update({ quantity: invRow.quantity - 1 }).eq('id', inventoryId)
  }

  const reward = (item.reward ?? {}) as { gold?: number; exp?: number; bonus_items?: Array<{ item_id: string; quantity: number }> }

  // Grant gold
  if (reward.gold && reward.gold > 0) {
    const { data: ps } = await admin
      .from('player_sessions')
      .select('gold')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single()
    const newGold = (ps?.gold ?? 0) + reward.gold
    await admin.from('player_sessions').update({ gold: newGold }).eq('user_id', userId).eq('session_id', sessionId)
  }

  // Grant exp (with level-up logic)
  if (reward.exp && reward.exp > 0) {
    const { data: ps } = await admin
      .from('player_sessions')
      .select('exp, level')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single()
    const newExp = (ps?.exp ?? 0) + reward.exp
    const newLevel = getLevelForExp(newExp)
    await admin.from('player_sessions')
      .update({ exp: newExp, level: Math.max(ps?.level ?? 1, newLevel) })
      .eq('user_id', userId)
      .eq('session_id', sessionId)
  }

  // Grant bonus items
  if (Array.isArray(reward.bonus_items)) {
    for (const bi of reward.bonus_items) {
      if (!bi.item_id) continue
      const { data: existing } = await admin
        .from('player_inventory')
        .select('id, quantity')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .eq('item_id', bi.item_id)
        .maybeSingle()
      if (existing) {
        await admin.from('player_inventory').update({ quantity: existing.quantity + (bi.quantity ?? 1) }).eq('id', existing.id)
      } else {
        await admin.from('player_inventory').insert({ user_id: userId, session_id: sessionId, item_id: bi.item_id, quantity: bi.quantity ?? 1 })
      }
    }
  }

  // Create player notification
  await admin.from('player_notifications').insert({
    user_id: userId,
    session_id: sessionId,
    type: 'item_redeemed',
    payload: {
      item_name: item.name,
      reward: {
        gold: reward.gold ?? 0,
        exp: reward.exp ?? 0,
        bonus_items: reward.bonus_items ?? [],
      },
    },
  })

  return NextResponse.json({
    success: true,
    itemName: item.name,
    reward: {
      gold: reward.gold ?? 0,
      exp: reward.exp ?? 0,
      bonus_items: reward.bonus_items ?? [],
    },
  })
}
