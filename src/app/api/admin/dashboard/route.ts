import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Fetch profiles for a list of user_ids, return a map uid → nickname
async function profileMap(supabase: Awaited<ReturnType<typeof createClient>>, userIds: string[]) {
  if (!userIds.length) return {} as Record<string, string>
  const { data } = await supabase
    .from('profiles')
    .select('user_id, nickname')
    .in('user_id', userIds)
  return Object.fromEntries((data ?? []).map(p => [p.user_id, p.nickname ?? p.user_id.slice(0, 8)]))
}

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

  // ── Detail drilldowns ────────────────────────────────────────────────────────

  if (detail === 'catches') {
    const { data } = await supabase
      .from('encounters')
      .select('id, resolved_at, user_id, creatures(name, rarity, element)')
      .eq('session_id', sessionId)
      .eq('status', 'caught')
      .order('resolved_at', { ascending: false })
      .limit(100)

    const uids = [...new Set((data ?? []).map(r => r.user_id))]
    const profiles = await profileMap(supabase, uids)
    const rows = (data ?? []).map(r => ({ ...r, nickname: profiles[r.user_id] ?? null }))
    return NextResponse.json({ rows })
  }

  if (detail === 'encounters') {
    const { data } = await supabase
      .from('encounters')
      .select('id, status, started_at, user_id, creatures(name, rarity, element)')
      .eq('session_id', sessionId)
      .order('started_at', { ascending: false })
      .limit(100)

    const uids = [...new Set((data ?? []).map(r => r.user_id))]
    const profiles = await profileMap(supabase, uids)
    const rows = (data ?? []).map(r => ({ ...r, nickname: profiles[r.user_id] ?? null }))
    return NextResponse.json({ rows })
  }

  if (detail === 'duels') {
    const { data } = await supabase
      .from('duels')
      .select('id, status, started_at, winner_id, challenger_id, opponent_id')
      .eq('session_id', sessionId)
      .order('started_at', { ascending: false })
      .limit(100)

    const uids = [...new Set([
      ...(data ?? []).map(r => r.challenger_id),
      ...(data ?? []).map(r => r.opponent_id),
    ].filter(Boolean))]
    const profiles = await profileMap(supabase, uids)
    const rows = (data ?? []).map(r => ({
      ...r,
      challenger_nick: profiles[r.challenger_id] ?? null,
      opponent_nick: profiles[r.opponent_id] ?? null,
      winner_nick: r.winner_id ? (profiles[r.winner_id] ?? null) : null,
    }))
    return NextResponse.json({ rows })
  }

  if (detail === 'bosses') {
    const { data } = await supabase
      .from('boss_fights')
      .select('id, status, created_at, user_id, boss_lineup, reward')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(100)

    const uids = [...new Set((data ?? []).map(r => r.user_id))]
    const profiles = await profileMap(supabase, uids)
    const rows = (data ?? []).map(r => ({ ...r, nickname: profiles[r.user_id] ?? null }))
    return NextResponse.json({ rows })
  }

  // ── Summary stats ────────────────────────────────────────────────────────────

  const [players, encounters, caught, duels, bosses, session] = await Promise.all([
    supabase.from('player_sessions').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    supabase.from('encounters').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    supabase.from('encounters').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('status', 'caught'),
    supabase.from('duels').select('id, status', { count: 'exact' }).eq('session_id', sessionId),
    supabase.from('boss_fights').select('id, status', { count: 'exact' }).eq('session_id', sessionId),
    supabase.from('sessions').select('status, end_at, start_at, duration_minutes, name').eq('id', sessionId).single(),
  ])

  return NextResponse.json({
    sessionName: session.data?.name,
    sessionStatus: session.data?.status,
    endAt: session.data?.end_at,
    startAt: session.data?.start_at,
    durationMinutes: session.data?.duration_minutes,
    playerCount: players.count ?? 0,
    encounterTotal: encounters.count ?? 0,
    caughtCount: caught.count ?? 0,
    duelCount: duels.count ?? 0,
    activeDuels: duels.data?.filter(d => d.status === 'active').length ?? 0,
    bossCount: bosses.count ?? 0,
    bossWins: bosses.data?.filter(b => b.status === 'won').length ?? 0,
  })
}
