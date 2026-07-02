import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToSession } from '@/lib/push'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { sessionId } = await request.json()

  const { data: session } = await supabase
    .from('sessions')
    .select('duration_minutes, status, kind, end_at')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  if (session.status !== 'ready') {
    return NextResponse.json({ error: "La sessione deve essere in stato 'pronta'" }, { status: 400 })
  }

  const startAt = new Date()
  const isAvventura = (session as { kind?: string }).kind === 'avventura'
  // Avventura: persistent — keep the optional explicit deadline (or none).
  // Event: countdown = start + duration, as always.
  const endAt = isAvventura
    ? ((session as { end_at?: string | null }).end_at ?? null)
    : new Date(startAt.getTime() + session.duration_minutes * 60 * 1000).toISOString()

  await supabase.from('sessions').update({
    status: 'active',
    start_at: startAt.toISOString(),
    end_at: endAt,
  }).eq('id', sessionId)

  after(() => sendPushToSession(sessionId, {
    title: isAvventura ? '🗺️ L\'avventura è iniziata!' : '🎮 La sessione è iniziata!',
    body: isAvventura
      ? 'Esplora, completa le missioni e torna ogni giorno per la tua ricompensa!'
      : `Hai ${session.duration_minutes} minuti per esplorare. Buon gioco!`,
    url: '/game/map',
    tag: `session_${sessionId}_start`,
  }))

  return NextResponse.json({ started: true, endAt })
}
