import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/game/prizes?sessionId=...  — the player's won special-prize vouchers.
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const { data, error } = await supabase
    .from('player_prizes')
    .select('id, code, won_at, redeemed_at, prize:special_prizes(id, name, description, rarity, image_url, redemption_note)')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .order('won_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prizes: data ?? [] })
}
