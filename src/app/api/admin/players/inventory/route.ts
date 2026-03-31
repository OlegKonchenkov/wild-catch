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

// GET /api/admin/players/inventory?userId=X&sessionId=Y
export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const sessionId = searchParams.get('sessionId')
  if (!userId || !sessionId) return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('player_inventory')
    .select('id, item_id, quantity, items(id, name, type, image_url, is_redeemable, reward)')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('item_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inventory: data ?? [] })
}

// DELETE /api/admin/players/inventory — remove item from player inventory
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { inventoryId, quantity } = await request.json().catch(() => ({}))
  if (!inventoryId) return NextResponse.json({ error: 'inventoryId richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('player_inventory')
    .select('id, quantity')
    .eq('id', inventoryId)
    .single()

  if (!row) return NextResponse.json({ error: 'Oggetto non trovato' }, { status: 404 })

  const removeQty = quantity ? Math.min(Number(quantity), row.quantity) : row.quantity
  if (removeQty >= row.quantity) {
    await admin.from('player_inventory').delete().eq('id', inventoryId)
  } else {
    await admin.from('player_inventory').update({ quantity: row.quantity - removeQty }).eq('id', inventoryId)
  }

  return NextResponse.json({ deleted: true })
}
