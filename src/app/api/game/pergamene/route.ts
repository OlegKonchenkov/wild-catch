import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/game/pergamene?sessionId=... → { unopened }
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const { count } = await supabase
    .from('player_pergamene')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .is('opened_at', null)

  return NextResponse.json({ unopened: count ?? 0 })
}
