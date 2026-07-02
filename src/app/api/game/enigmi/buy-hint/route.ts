import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'

/** Gemme cost to unlock one enigma hint. */
export const HINT_GEMME_COST = 10

// POST /api/game/enigmi/buy-hint — body: { enigmaId, sessionId }
// Spends gemme to reveal the next not-yet-owned suggerimento of an enigma.
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { enigmaId, sessionId } = await request.json().catch(() => ({}))
  if (!enigmaId || !sessionId) return NextResponse.json({ error: 'enigmaId e sessionId richiesti' }, { status: 400 })

  const { data: sessionCheck } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'La sessione non è attiva' }, { status: 403 })
  }

  const admin = createAdminClient()

  // All hints for this enigma, ordered
  const { data: hints } = await admin
    .from('enigma_suggerimenti')
    .select('id, text, image_url, order_index')
    .eq('enigma_id', enigmaId)
    .order('order_index', { ascending: true })
  if (!hints || hints.length === 0) {
    return NextResponse.json({ error: 'Questo enigma non ha indizi' }, { status: 404 })
  }

  // Which does the player already own?
  const { data: owned } = await admin
    .from('player_enigma_suggerimenti')
    .select('suggerimento_id')
    .eq('user_id', user.id).eq('session_id', sessionId)
  const ownedIds = new Set((owned ?? []).map((r: any) => r.suggerimento_id))

  const next = hints.find(h => !ownedIds.has(h.id))
  if (!next) return NextResponse.json({ error: 'Hai già sbloccato tutti gli indizi', allUnlocked: true }, { status: 400 })

  // Deduct gemme (optimistic lock)
  const { data: ps } = await supabase
    .from('player_sessions').select('id, gemme')
    .eq('user_id', user.id).eq('session_id', sessionId).single()
  if (!ps) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  const balance = (ps as { gemme: number }).gemme ?? 0
  if (balance < HINT_GEMME_COST) {
    return NextResponse.json({ error: 'Gemme insufficienti', cost: HINT_GEMME_COST, have: balance }, { status: 402 })
  }
  const { data: upd, error: updErr } = await supabase
    .from('player_sessions')
    .update({ gemme: balance - HINT_GEMME_COST })
    .eq('id', ps.id).eq('gemme', balance)
    .select('id')
  if (updErr || !upd || upd.length === 0) {
    return NextResponse.json({ error: 'Errore transazione (riprova)' }, { status: 409 })
  }

  // Grant the hint
  const { error: grantErr } = await admin.from('player_enigma_suggerimenti').upsert(
    { user_id: user.id, session_id: sessionId, suggerimento_id: next.id },
    { onConflict: 'user_id,session_id,suggerimento_id', ignoreDuplicates: true },
  )
  if (grantErr) {
    await supabase.from('player_sessions').update({ gemme: balance }).eq('id', ps.id) // refund
    return NextResponse.json({ error: grantErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    remainingGemme: balance - HINT_GEMME_COST,
    hint: { id: next.id, text: next.text, image_url: next.image_url, order_index: next.order_index },
  })
}
