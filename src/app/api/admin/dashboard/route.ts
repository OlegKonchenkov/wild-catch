import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const detail = searchParams.get('detail')

  // Detail drilldown
  if (detail === 'catches') {
    const { data } = await supabase
      .from('encounters')
      .select('id, caught_at:updated_at, creatures(name, rarity, element), player_sessions!inner(user_id, profiles(nickname))')
      .eq('session_id', sessionId)
      .eq('status', 'caught')
      .order('updated_at', { ascending: false })
      .limit(100)
    return NextResponse.json({ rows: data ?? [] })
  }

  if (detail === 'encounters') {
    const { data } = await supabase
      .from('encounters')
      .select('id, status, created_at, creatures(name, rarity, element), player_sessions!inner(user_id, profiles(nickname))')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(100)
    return NextResponse.json({ rows: data ?? [] })
  }

  if (detail === 'duels') {
    const { data } = await supabase
      .from('duels')
      .select('id, status, created_at, winner_id, player1_id, player2_id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(100)
    return NextResponse.json({ rows: data ?? [] })
  }

  if (detail === 'bosses') {
    const { data } = await supabase
      .from('boss_fights')
      .select('id, status, created_at, boss_lineup, reward')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(100)
    return NextResponse.json({ rows: data ?? [] })
  }

  const [players, encounters, caught, duels, bosses, session] = await Promise.all([
    supabase.from('player_sessions').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    supabase.from('encounters').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    supabase.from('encounters').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('status', 'caught'),
    supabase.from('duels').select('id, status', { count: 'exact' }).eq('session_id', sessionId),
    supabase.from('boss_fights').select('id, status', { count: 'exact' }).eq('session_id', sessionId),
    supabase.from('sessions').select('status, end_at, start_at, duration_minutes, name').eq('id', sessionId).single(),
  ])

  const caughtCount = caught.count ?? 0

  return NextResponse.json({
    sessionName: session.data?.name,
    sessionStatus: session.data?.status,
    endAt: session.data?.end_at,
    startAt: session.data?.start_at,
    durationMinutes: session.data?.duration_minutes,
    playerCount: players.count ?? 0,
    encounterTotal: encounters.count ?? 0,
    caughtCount,
    duelCount: duels.count ?? 0,
    activeDuels: duels.data?.filter(d => d.status === 'active').length ?? 0,
    bossCount: bosses.count ?? 0,
    bossWins: bosses.data?.filter(b => b.status === 'won').length ?? 0,
  })
}
