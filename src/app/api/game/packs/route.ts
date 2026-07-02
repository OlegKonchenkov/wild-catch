import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/game/packs?sessionId=...  — owned unopened packs for this session.
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const { data, error } = await supabase
    .from('player_packs')
    .select('id, quantity, pack_id, pack:packs(id, name, description, rarity, image_url, min_drops, max_drops)')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .gt('quantity', 0)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ packs: data ?? [] })
}
