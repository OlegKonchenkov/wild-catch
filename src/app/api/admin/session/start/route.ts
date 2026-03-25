import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { sessionId } = await request.json()

  const { data: session } = await supabase
    .from('sessions')
    .select('duration_minutes, status')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  if (session.status !== 'ready') {
    return NextResponse.json({ error: "La sessione deve essere in stato 'pronta'" }, { status: 400 })
  }

  const startAt = new Date()
  const endAt = new Date(startAt.getTime() + session.duration_minutes * 60 * 1000)

  await supabase.from('sessions').update({
    status: 'active',
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
  }).eq('id', sessionId)

  return NextResponse.json({ started: true, endAt: endAt.toISOString() })
}
