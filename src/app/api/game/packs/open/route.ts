import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispenseReward, type RewardType } from '@/lib/game/rewards/dispense'
import { drawFromPool, rollDropCount, type PoolEntry } from '@/lib/game/rewards/draw'
import type { Json } from '@/types/database'

// POST /api/game/packs/open  — body: { packId, sessionId }
// Opens one owned pack: draws 3–5 weighted rewards, grants each, decrements.
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { packId, sessionId } = await request.json().catch(() => ({}))
  if (!packId || !sessionId) {
    return NextResponse.json({ error: 'packId e sessionId richiesti' }, { status: 400 })
  }

  // Session must be active
  const { data: sessionCheck } = await supabase
    .from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'Sessione non attiva' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Ownership: player must hold at least one of this pack in this session
  const { data: owned } = await admin
    .from('player_packs')
    .select('id, quantity')
    .eq('user_id', user.id).eq('session_id', sessionId).eq('pack_id', packId)
    .maybeSingle()
  if (!owned || owned.quantity <= 0) {
    return NextResponse.json({ error: 'Non possiedi questa bustina', notOwned: true }, { status: 422 })
  }

  // Load catalogue + pool
  const { data: pack } = await admin
    .from('packs').select('id, name, image_url, rarity, min_drops, max_drops').eq('id', packId).single()
  if (!pack) return NextResponse.json({ error: 'Bustina non trovata' }, { status: 404 })

  const { data: poolRows } = await admin
    .from('pack_pool')
    .select('reward_type, reward_payload, weight, min_qty, max_qty')
    .eq('pack_id', packId)
  const pool: PoolEntry[] = (poolRows ?? []).map((r) => ({
    reward_type: r.reward_type,
    reward_payload: (r.reward_payload as Record<string, any>) ?? {},
    weight: r.weight,
    min_qty: r.min_qty,
    max_qty: r.max_qty,
  }))
  if (pool.length === 0) {
    return NextResponse.json({ error: 'Bustina senza contenuti configurati' }, { status: 422 })
  }

  // Draw and dispense
  const count = rollDropCount(pack.min_drops, pack.max_drops)
  const drops = drawFromPool(pool, count)
  const results = []
  for (const drop of drops) {
    const res = await dispenseReward(admin, {
      userId: user.id, sessionId, type: drop.reward_type as RewardType, payload: drop.payload,
    })
    results.push(res)
  }

  // Decrement (delete row when it reaches zero)
  if (owned.quantity <= 1) {
    await admin.from('player_packs').delete().eq('id', owned.id)
  } else {
    await admin.from('player_packs').update({ quantity: owned.quantity - 1 }).eq('id', owned.id)
  }

  // Bell/history event
  admin.from('player_game_events').insert({
    user_id: user.id, session_id: sessionId, type: 'pack_opened',
    payload: { pack_name: pack.name, drop_count: results.length } as Json,
  }).then(undefined, () => {})

  return NextResponse.json({
    success: true,
    pack: { id: pack.id, name: pack.name, image_url: pack.image_url, rarity: pack.rarity },
    drops: results,
  })
}
