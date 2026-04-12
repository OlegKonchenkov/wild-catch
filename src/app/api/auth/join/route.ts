import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  // Auth check via user client (RLS)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { code } = body

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json({ error: 'Codice invito mancante' }, { status: 400 })
  }

  // Use admin client to bypass RLS on session_invites
  const admin = createAdminClient()

  // Find invite (separate from session join to avoid FK ambiguity)
  const { data: invite, error: inviteError } = await admin
    .from('session_invites')
    .select('id, code, session_id, is_active, used_by_user_id')
    .eq('code', code.trim().toUpperCase())
    .eq('is_active', true)
    .is('used_by_user_id', null)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Codice non valido o già utilizzato' }, { status: 404 })
  }

  // Check session status separately (avoids FK join ambiguity)
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('id, status, starter_kit')
    .eq('id', invite.session_id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  }

  if (!['draft', 'ready', 'active', 'ended'].includes(session.status)) {
    return NextResponse.json({ error: "L'evento non è ancora disponibile" }, { status: 403 })
  }

  const sessionId = invite.session_id

  // Check player not already in session
  const { data: existing } = await admin
    .from('player_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (existing) {
    // Already joined — just return sessionId (idempotent)
    return NextResponse.json({
      sessionId,
      alreadyJoined: true,
      sessionStatus: session.status,
      pendingStart: session.status === 'draft',
      viewOnly: session.status === 'ended',
    })
  }

  // Mark invite as used (set is_active false + record who used it)
  const { error: updateError } = await admin
    .from('session_invites')
    .update({
      used_by_user_id: user.id,
      used_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('id', invite.id)

  if (updateError) {
    return NextResponse.json({ error: 'Errore di sistema aggiornando il codice' }, { status: 500 })
  }

  // Create player session
  const { error: psError } = await admin.from('player_sessions').insert({
    user_id: user.id,
    session_id: sessionId,
    gold: 100,
  })

  if (psError) {
    // Rollback: re-enable the invite code so the player can retry
    await admin
      .from('session_invites')
      .update({ used_by_user_id: null, used_at: null, is_active: true })
      .eq('id', invite.id)
    return NextResponse.json({ error: 'Errore creazione profilo giocatore' }, { status: 500 })
  }

  // REQ-INV-03: give starter kit — session-configured or fallback to 5x Rete Base
  const starterKit: Array<{ item_id: string; quantity: number }> = Array.isArray(session.starter_kit)
    ? (session.starter_kit as Array<{ item_id: string; quantity: number }>)
    : []

  if (starterKit.length > 0) {
    const kitRows = starterKit
      .filter(k => k.item_id && k.quantity > 0)
      .map(k => ({ user_id: user.id, session_id: sessionId, item_id: k.item_id, quantity: k.quantity }))
    if (kitRows.length > 0) await admin.from('player_inventory').insert(kitRows)
  } else {
    // Fallback: 5x Rete Base
    const { data: reteBase } = await admin.from('items').select('id').eq('name', 'Rete Base').single()
    if (reteBase) {
      await admin.from('player_inventory').insert({
        user_id: user.id, session_id: sessionId, item_id: reteBase.id, quantity: 5,
      })
    }
  }

  return NextResponse.json({
    sessionId,
    sessionStatus: session.status,
    pendingStart: session.status === 'draft',
    viewOnly: session.status === 'ended',
  })
}

