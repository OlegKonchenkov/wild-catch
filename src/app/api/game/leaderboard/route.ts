import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/game/leaderboard?sessionId=X
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  // Use admin client to bypass RLS — every player in the session can see the full leaderboard
  const adminSupabase = createAdminClient()
  const { data: players } = await adminSupabase
    .from('player_sessions')
    .select('user_id, score')
    .eq('session_id', sessionId)
    .order('score', { ascending: false })
    .limit(50)

  if (!players || players.length === 0) return NextResponse.json({ leaderboard: [] })

  // Fetch profiles separately (avoids FK name ambiguity)
  const userIds = players.map(p => p.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, nickname')
    .in('user_id', userIds)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.nickname]))

  const leaderboard = players.map((p, i) => ({
    rank: i + 1,
    user_id: p.user_id,
    nickname: profileMap[p.user_id] ?? 'Anonimo',
    score: p.score ?? 0,
    isMe: p.user_id === user.id,
  }))

  // No Cache-Control. Players expect their rank to update right after a catch;
  // a cache made the leaderboard lag behind their own score. Negligible perf
  // cost to serve fresh on NANO.
  return NextResponse.json({ leaderboard })
}
