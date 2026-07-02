import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispenseReward, type RewardType } from '@/lib/game/rewards/dispense'
import { checkKeyRequirements, type KeyRequirement } from '@/lib/game/rewards/keys'
import type { Json } from '@/types/database'

// POST /api/game/chests/open — body: { chestId, sessionId }
// Verifies + consumes the required keys, then grants the chest's fixed contents.
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { chestId, sessionId } = await request.json().catch(() => ({}))
  if (!chestId || !sessionId) {
    return NextResponse.json({ error: 'chestId e sessionId richiesti' }, { status: 400 })
  }

  const { data: sessionCheck } = await supabase
    .from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'Sessione non attiva' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Ownership
  const { data: owned } = await admin
    .from('player_chests')
    .select('id, quantity')
    .eq('user_id', user.id).eq('session_id', sessionId).eq('chest_id', chestId)
    .maybeSingle()
  if (!owned || owned.quantity <= 0) {
    return NextResponse.json({ error: 'Non possiedi questo forziere', notOwned: true }, { status: 422 })
  }

  // Chest catalogue
  const { data: chest } = await admin
    .from('chests').select('id, name, image_url, rarity, key_requirements, contents').eq('id', chestId).single()
  if (!chest) return NextResponse.json({ error: 'Forziere non trovato' }, { status: 404 })

  const requirements = (chest.key_requirements as unknown as KeyRequirement[]) ?? []

  // Load the player's key inventory rows referenced by the requirements
  const keyIds = requirements.map(r => r.item_id)
  const invByItem: Record<string, { id: string; quantity: number }> = {}
  if (keyIds.length > 0) {
    const { data: invRows } = await admin
      .from('player_inventory')
      .select('id, item_id, quantity')
      .eq('user_id', user.id).eq('session_id', sessionId)
      .in('item_id', keyIds)
    for (const row of invRows ?? []) invByItem[row.item_id] = { id: row.id, quantity: row.quantity }
  }
  const ownedCounts = Object.fromEntries(Object.entries(invByItem).map(([k, v]) => [k, v.quantity]))

  const check = checkKeyRequirements(requirements, ownedCounts)
  if (!check.ok) {
    // Enrich missing keys with their item names for the UI
    const missingIds = check.missing.map(m => m.item_id)
    const { data: keyItems } = await admin.from('items').select('id, name').in('id', missingIds)
    const nameById = Object.fromEntries((keyItems ?? []).map(k => [k.id, k.name]))
    return NextResponse.json({
      error: 'Ti mancano delle chiavi',
      missingKeys: true,
      missing: check.missing.map(m => ({ ...m, name: nameById[m.item_id] ?? 'Chiave' })),
    }, { status: 422 })
  }

  // Consume keys
  for (const req of requirements) {
    const inv = invByItem[req.item_id]
    const needed = Math.max(1, Number(req.qty) || 1)
    const remaining = inv.quantity - needed
    if (remaining <= 0) {
      await admin.from('player_inventory').delete().eq('id', inv.id)
    } else {
      await admin.from('player_inventory').update({ quantity: remaining }).eq('id', inv.id)
    }
  }

  // Dispense fixed contents
  const contents = (chest.contents as unknown as Array<{ type: string; payload: Record<string, any> }>) ?? []
  const results = []
  for (const item of contents) {
    const res = await dispenseReward(admin, {
      userId: user.id, sessionId, type: item.type as RewardType, payload: item.payload ?? {},
    })
    results.push(res)
  }

  // Decrement chest
  if (owned.quantity <= 1) {
    await admin.from('player_chests').delete().eq('id', owned.id)
  } else {
    await admin.from('player_chests').update({ quantity: owned.quantity - 1 }).eq('id', owned.id)
  }

  admin.from('player_game_events').insert({
    user_id: user.id, session_id: sessionId, type: 'chest_opened',
    payload: { chest_name: chest.name, drop_count: results.length } as Json,
  }).then(undefined, () => {})

  return NextResponse.json({
    success: true,
    chest: { id: chest.id, name: chest.name, image_url: chest.image_url, rarity: chest.rarity },
    contents: results,
  })
}
