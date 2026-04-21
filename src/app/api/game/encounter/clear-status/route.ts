import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { encounterId } = body

  if (!encounterId) {
    return NextResponse.json({ error: 'encounterId mancante' }, { status: 400 })
  }

  const { data: encounter } = await supabase
    .from('encounters')
    .select('id')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!encounter) {
    return NextResponse.json({ error: 'Incontro non trovato' }, { status: 404 })
  }

  await supabase
    .from('encounters')
    .update({
      player_status: null,
      player_status_turns: 0,
    })
    .eq('id', encounterId)

  return NextResponse.json({ ok: true })
}
