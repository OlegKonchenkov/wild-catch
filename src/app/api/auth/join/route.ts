import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { code } = body

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json({ error: 'codice invito mancante' }, { status: 400 })
  }

  // Find invite code
  const { data: invite, error: inviteError } = await supabase
    .from('session_invites')
    .select('*, sessions!inner(id, status)')
    .eq('code', code.trim().toUpperCase())
    .eq('is_active', true)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Codice non valido o già usato' }, { status: 404 })
  }

  // Check code not already used
  if (invite.used_by_user_id) {
    return NextResponse.json({ error: 'Codice già utilizzato' }, { status: 409 })
  }

  // Check session is ready or active
  const sessionStatus = (invite as any).sessions.status
  if (!['ready', 'active'].includes(sessionStatus)) {
    return NextResponse.json({ error: "L'evento non è ancora disponibile" }, { status: 403 })
  }

  const sessionId = invite.session_id

  // Check player not already in session
  const { data: existing } = await supabase
    .from('player_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (existing) {
    // Already joined, just mark code as used if not yet
    return NextResponse.json({ sessionId, alreadyJoined: true })
  }

  // Mark invite as used and create player_session atomically
  const { error: updateError } = await supabase
    .from('session_invites')
    .update({ used_by_user_id: user.id, used_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (updateError) {
    return NextResponse.json({ error: 'Errore di sistema' }, { status: 500 })
  }

  // Create player session with starter kit
  const { error: psError } = await supabase.from('player_sessions').insert({
    user_id: user.id,
    session_id: sessionId,
    gold: 100,
  })

  if (psError) {
    return NextResponse.json({ error: 'Errore creazione profilo giocatore' }, { status: 500 })
  }

  // Give starter kit: 5x Rete Base
  const { data: reteBase } = await supabase
    .from('items')
    .select('id')
    .eq('name', 'Rete Base')
    .single()

  if (reteBase) {
    await supabase.from('player_inventory').insert({
      user_id: user.id,
      session_id: sessionId,
      item_id: reteBase.id,
      quantity: 5,
    })
  }

  return NextResponse.json({ sessionId })
}
