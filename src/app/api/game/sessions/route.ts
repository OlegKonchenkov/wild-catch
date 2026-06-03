import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/game/sessions — list all sessions the authenticated user has joined, with per-session stats
export async function GET() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // 1. All sessions this user participated in (excluding the always-on
  // Tutorial session — it has its own card on /home and shouldn't pollute
  // the real-event history).
  const { data: playerSessions } = await supabase
    .from('player_sessions')
    .select('session_id, exp, gold, level, sessions(id, name, status, start_at, end_at, kind)')
    .eq('user_id', user.id)

  if (!playerSessions || playerSessions.length === 0) {
    return NextResponse.json({ sessions: [] })
  }

  const realSessions = playerSessions.filter(ps => {
    const sess = ps.sessions as unknown as { kind?: string } | null
    return sess?.kind !== 'tutorial'
  })

  if (realSessions.length === 0) {
    return NextResponse.json({ sessions: [] })
  }

  const sessionIds = realSessions.map(ps => ps.session_id)
  const adminClient = createAdminClient()

  // 2. Creature counts for all sessions in one query
  const { data: creatures } = await adminClient
    .from('player_creatures')
    .select('session_id')
    .eq('user_id', user.id)
    .in('session_id', sessionIds)

  const creatureCount: Record<string, number> = {}
  for (const c of creatures ?? []) {
    creatureCount[c.session_id] = (creatureCount[c.session_id] ?? 0) + 1
  }

  // 3. Duel stats — challenger side + opponent side
  const [{ data: duelsC }, { data: duelsO }] = await Promise.all([
    adminClient
      .from('duels')
      .select('session_id, winner_id')
      .eq('challenger_id', user.id)
      .eq('status', 'ended')
      .in('session_id', sessionIds),
    adminClient
      .from('duels')
      .select('session_id, winner_id')
      .eq('opponent_id', user.id)
      .eq('status', 'ended')
      .in('session_id', sessionIds),
  ])

  const duelStats: Record<string, { wins: number; total: number }> = {}
  for (const d of [...(duelsC ?? []), ...(duelsO ?? [])]) {
    if (!duelStats[d.session_id]) duelStats[d.session_id] = { wins: 0, total: 0 }
    duelStats[d.session_id].total++
    if (d.winner_id === user.id) duelStats[d.session_id].wins++
  }

  // 4. Build response, active sessions first then by start_at desc
  const sessions = realSessions
    .map(ps => {
      const sess = ps.sessions as unknown as { id: string; name: string; status: string; start_at: string | null; end_at: string | null } | null
      return {
        id: ps.session_id,
        name: sess?.name ?? 'Sessione',
        status: sess?.status ?? 'draft',
        start_at: sess?.start_at ?? null,
        end_at: sess?.end_at ?? null,
        exp: ps.exp ?? 0,
        gold: ps.gold ?? 0,
        level: ps.level ?? 1,
        creatures_caught: creatureCount[ps.session_id] ?? 0,
        duel_wins: duelStats[ps.session_id]?.wins ?? 0,
        duel_total: duelStats[ps.session_id]?.total ?? 0,
      }
    })
    .sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (b.status === 'active' && a.status !== 'active') return 1
      return (b.start_at ?? '').localeCompare(a.start_at ?? '')
    })

  // No Cache-Control. /home refetches this right after joining a session and
  // expects the new session to appear; a 30s cache could hide it. Same
  // stale-after-write class as the nickname bug. Negligible perf cost on NANO.
  return NextResponse.json({ sessions })
}
