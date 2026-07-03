import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/game/leaderboard?sessionId=X&filter=friends|group
// filter=friends → solo i miei amici (accettati) + me
// filter=group   → solo i membri del mio gruppo
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  const filter = url.searchParams.get('filter')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  // Use admin client to bypass RLS — every player in the session can see the full leaderboard
  const adminSupabase = createAdminClient()

  // Filtri sociali: costruiamo l'insieme di user_id ammessi (io incluso).
  let allowedIds: Set<string> | null = null
  if (filter === 'friends') {
    const { data: rows } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    allowedIds = new Set<string>([user.id])
    for (const r of rows ?? []) {
      allowedIds.add(r.requester_id === user.id ? r.addressee_id : r.requester_id)
    }
  } else if (filter === 'group') {
    const { data: mine } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (!mine) return NextResponse.json({ leaderboard: [], noGroup: true })
    const { data: members } = await adminSupabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', mine.group_id)
    allowedIds = new Set((members ?? []).map(m => m.user_id))
    allowedIds.add(user.id)
  }

  let playersQuery = adminSupabase
    .from('player_sessions')
    .select('user_id, score')
    .eq('session_id', sessionId)
    .order('score', { ascending: false })
    .limit(allowedIds ? 200 : 50)

  const { data: playersRaw } = await playersQuery
  const players = allowedIds
    ? (playersRaw ?? []).filter(p => allowedIds!.has(p.user_id)).slice(0, 50)
    : playersRaw

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
