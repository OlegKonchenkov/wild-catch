import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/supabase/auth-fast'

/**
 * GET /api/game/hall-of-fame?sessionId=X
 *
 * The top-10 snapshot frozen by /api/admin/session/close when the event ended.
 *
 * That table has been populated since the close route was written and read by
 * absolutely nothing — so the closing ceremony, the moment an event is supposed
 * to pay off, simply didn't exist in the app. This is the read side.
 *
 * Unlike /api/game/leaderboard (live `player_sessions.score`, changes with
 * every catch) this is the final, immutable result: it keeps its ranking even
 * if rows are edited afterwards, and it carries the season label the organiser
 * gave the event.
 */
export async function GET(request: Request) {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const supabase = await createClient()

  // Only players who took part in the event can see its Hall of Fame.
  const { data: membership } = await supabase
    .from('player_sessions')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  // Admin client: every participant sees the full podium, not just their row.
  const admin = createAdminClient()
  const { data: entries } = await admin
    .from('hall_of_fame')
    .select('user_id, rank, score, creatures_caught, season_label, awarded_at')
    .eq('session_id', sessionId)
    .order('rank')

  if (!entries || entries.length === 0) {
    return NextResponse.json({ hallOfFame: [], seasonLabel: null })
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, nickname')
    .in('user_id', entries.map(e => e.user_id))

  const nicknames = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.nickname]))

  return NextResponse.json({
    seasonLabel: entries[0].season_label ?? null,
    awardedAt: entries[0].awarded_at ?? null,
    hallOfFame: entries.map(e => ({
      rank: e.rank,
      userId: e.user_id,
      nickname: nicknames[e.user_id] ?? 'Anonimo',
      score: e.score ?? 0,
      creaturesCaught: e.creatures_caught ?? 0,
      isMe: e.user_id === user.id,
    })),
  })
}
