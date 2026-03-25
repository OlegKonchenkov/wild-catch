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

  const [players, encounters, caught, duels, session] = await Promise.all([
    supabase.from('player_sessions').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    supabase.from('encounters').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    supabase.from('encounters').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('status', 'caught'),
    supabase.from('duels').select('id, status', { count: 'exact' }).eq('session_id', sessionId),
    supabase.from('sessions').select('status, end_at, name').eq('id', sessionId).single(),
  ])

  const caughtCount = caught.count ?? 0

  return NextResponse.json({
    sessionName: session.data?.name,
    sessionStatus: session.data?.status,
    endAt: session.data?.end_at,
    playerCount: players.count ?? 0,
    encounterTotal: encounters.count ?? 0,
    caughtCount,
    duelCount: duels.count ?? 0,
    activeDuels: duels.data?.filter(d => d.status === 'active').length ?? 0,
  })
}
