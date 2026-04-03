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

// POST /api/admin/players/redeem-qr
// body: { userId, sessionId, qrContent }
// qrContent is the raw string decoded from the QR code (the qr_codes.id UUID)
export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { userId, sessionId, qrContent } = await request.json().catch(() => ({}))
  if (!userId || !sessionId || !qrContent) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Extract QR code ID — the QR content is just the UUID
  const qrId = qrContent.trim()

  const admin = createAdminClient()

  // Guard: session must still be active
  const { data: sessionCheck } = await admin.from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'La sessione è terminata' }, { status: 403 })
  }

  // Look up the QR code
  const { data: qr } = await admin
    .from('qr_codes')
    .select('id, type, payload, label')
    .eq('id', qrId)
    .maybeSingle()

  if (!qr) {
    return NextResponse.json({ error: 'QR code non riconosciuto' }, { status: 404 })
  }

  if (qr.type !== 'oggetto') {
    return NextResponse.json({ error: `Questo QR è di tipo "${qr.type}", non un oggetto riscattabile` }, { status: 400 })
  }

  const payload = qr.payload as { item_id?: string; quantity?: number }
  if (!payload?.item_id) {
    return NextResponse.json({ error: 'QR code non contiene un item_id valido' }, { status: 400 })
  }

  // Look up the item — must be custom and redeemable
  const { data: item } = await admin
    .from('items')
    .select('id, name, type, is_redeemable, reward')
    .eq('id', payload.item_id)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Oggetto collegato al QR non trovato' }, { status: 404 })
  }
  if (item.type !== 'custom' || !item.is_redeemable) {
    return NextResponse.json({ error: 'L\'oggetto non è un custom item riscattabile' }, { status: 400 })
  }

  const reward = (item.reward ?? {}) as {
    gold?: number
    exp?: number
    bonus_items?: Array<{ item_id: string; quantity: number }>
  }

  // Grant gold
  if (reward.gold && reward.gold > 0) {
    const { data: ps } = await admin
      .from('player_sessions')
      .select('gold')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single()
    const newGold = (ps?.gold ?? 0) + reward.gold
    await admin.from('player_sessions')
      .update({ gold: newGold })
      .eq('user_id', userId).eq('session_id', sessionId)
  }

  // Grant exp (with level-up logic via RPC)
  if (reward.exp && reward.exp > 0) {
    await admin.rpc('increment_player_stats', {
      p_user_id: userId,
      p_session_id: sessionId,
      p_exp: reward.exp,
      p_score: 0,
    })
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
        await admin.from('player_inventory')
          .update({ quantity: existing.quantity + (bi.quantity ?? 1) })
          .eq('id', existing.id)
      } else {
        await admin.from('player_inventory').insert({
          user_id: userId, session_id: sessionId,
          item_id: bi.item_id, quantity: bi.quantity ?? 1,
        })
      }
    }
  }

  // Notify the player
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

  // Also write a game event so it appears in the events history tab
  admin.from('player_game_events').insert({
    user_id: userId,
    session_id: sessionId,
    type: 'qr_redeemed',
    payload: {
      item_name: item.name,
      gold: reward.gold ?? 0,
      exp: reward.exp ?? 0,
    },
  }).then(undefined, () => {})

  return NextResponse.json({
    success: true,
    itemName: item.name,
    qrLabel: qr.label ?? null,
    reward: {
      gold: reward.gold ?? 0,
      exp: reward.exp ?? 0,
      bonus_items: reward.bonus_items ?? [],
    },
  })
}
