import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendPushToSession } from '@/lib/push'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { sessionId } = await request.json()
  const admin = createAdminClient()

  // Close session
  await admin.from('sessions').update({
    status: 'ended',
    end_at: new Date().toISOString(),
  }).eq('id', sessionId)

  // Generate leaderboard — top players by EXP
  const { data: players } = await admin
    .from('player_sessions')
    .select('user_id, exp, level')
    .eq('session_id', sessionId)
    .order('exp', { ascending: false })

  if (players) {
    // Get current session name for season label
    const { data: session } = await admin.from('sessions').select('name').eq('id', sessionId).single()
    const seasonLabel = session?.name ?? 'Evento Daimon'

    // Count creatures per player
    const hofEntries = await Promise.all(players.slice(0, 10).map(async (p, i) => {
      const { count } = await admin
        .from('player_creatures')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', p.user_id)
        .eq('session_id', sessionId)

      return {
        user_id: p.user_id,
        session_id: sessionId,
        rank: i + 1,
        score: p.exp,
        creatures_caught: count ?? 0,
        season_label: seasonLabel,
      }
    }))

    // Insert Hall of Fame entries
    await admin.from('hall_of_fame').insert(hofEntries)

    // Update score_final
    await Promise.all(players.map((p) =>
      admin.from('player_sessions')
        .update({ score_final: p.exp })
        .eq('user_id', p.user_id)
        .eq('session_id', sessionId)
    ))
  }

  // Broadcast session end via Realtime
  const channel = admin.channel(`session:${sessionId}`)
  await new Promise<void>(resolve => channel.subscribe(() => resolve()))
  await channel.send({
    type: 'broadcast',
    event: 'session_ended',
    payload: { sessionId },
  })
  await admin.removeChannel(channel)

  after(() => sendPushToSession(sessionId, {
    title: '🏁 Sessione terminata',
    body: 'L\'evento è concluso. Controlla classifica e DaimonDex!',
    url: '/home',
    tag: `session_${sessionId}_end`,
  }))

  return NextResponse.json({ closed: true })
}
