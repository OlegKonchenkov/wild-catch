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
    .select('id, player_hp')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!encounter) {
    return NextResponse.json({ error: 'Incontro non trovato' }, { status: 404 })
  }

  // Anti-cheat: clearing a status without consuming an item is only
  // legitimate when the active creature has just fainted and the client
  // is switching to a fresh one. If player_hp > 0 the creature is still
  // alive — clearing its status for free would be an exploit (sleep /
  // paralysis / confusion should burn down via turns or items).
  //
  // For legacy in-flight encounters (player_hp IS NULL, pre-migration
  // 037) we keep the previous permissive behaviour so nothing breaks.
  const ph = (encounter as any).player_hp as number | null
  if (typeof ph === 'number' && ph > 0) {
    return NextResponse.json(
      { error: 'Status can only be cleared on faint-switch' },
      { status: 403 },
    )
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
