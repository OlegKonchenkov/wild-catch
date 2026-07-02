import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/game/chests?sessionId=...
// Returns owned chests (with key requirements + contents) and the player's
// current key counts so the UI can show which chests are openable.
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const { data: chests, error } = await supabase
    .from('player_chests')
    .select('id, quantity, chest_id, chest:chests(id, name, description, rarity, image_url, key_requirements, contents)')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .gt('quantity', 0)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Player's key inventory (items of type 'chiave')
  const { data: keyRows } = await supabase
    .from('player_inventory')
    .select('quantity, item_id, items!inner(id, name, type, description)')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('items.type', 'chiave')
    .gt('quantity', 0)

  const keys = (keyRows ?? []).map((r: any) => ({
    item_id: r.item_id,
    name: r.items?.name ?? 'Chiave',
    quantity: r.quantity,
  }))

  return NextResponse.json({ chests: chests ?? [], keys })
}
