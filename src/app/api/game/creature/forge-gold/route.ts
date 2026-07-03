import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

/** Costo della forgiatura GOLD: 2 copie consumate + gemme. */
export const GOLD_FORGE_COPIES = 2
export const GOLD_FORGE_GEMME = 25

// POST /api/game/creature/forge-gold — body: { playerCreatureId, sessionId }
// Alla 3ª copia: consuma 2 copie + 25 gemme → variante GOLD (+10% stats base).
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { playerCreatureId, sessionId } = await request.json().catch(() => ({}))
  if (!playerCreatureId || !sessionId) {
    return NextResponse.json({ error: 'playerCreatureId e sessionId richiesti' }, { status: 400 })
  }

  const { data: sessionCheck } = await supabase
    .from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'Sessione non attiva' }, { status: 403 })
  }

  // La creatura deve essere mia, in questa sessione, con abbastanza copie
  const { data: pc } = await supabase
    .from('player_creatures')
    .select('id, duplicates_count, is_gold, creature:creatures(name)')
    .eq('id', playerCreatureId)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!pc) return NextResponse.json({ error: 'Creatura non trovata' }, { status: 404 })
  if ((pc as { is_gold?: boolean }).is_gold) {
    return NextResponse.json({ error: 'È già una variante GOLD!', alreadyGold: true }, { status: 409 })
  }
  if (pc.duplicates_count < GOLD_FORGE_COPIES + 1) {
    return NextResponse.json({
      error: `Servono ${GOLD_FORGE_COPIES + 1} copie (ne hai ${pc.duplicates_count})`,
      needCopies: GOLD_FORGE_COPIES + 1,
    }, { status: 422 })
  }

  // Gemme: deduzione con lock ottimistico
  const { data: ps } = await supabase
    .from('player_sessions').select('id, gemme')
    .eq('user_id', user.id).eq('session_id', sessionId).single()
  if (!ps) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  const balance = (ps as { gemme: number }).gemme ?? 0
  if (balance < GOLD_FORGE_GEMME) {
    return NextResponse.json({ error: `Gemme insufficienti (servono ${GOLD_FORGE_GEMME} 💎)`, cost: GOLD_FORGE_GEMME }, { status: 402 })
  }
  const { data: upd, error: updErr } = await supabase
    .from('player_sessions')
    .update({ gemme: balance - GOLD_FORGE_GEMME })
    .eq('id', ps.id).eq('gemme', balance)
    .select('id')
  if (updErr || !upd || upd.length === 0) {
    return NextResponse.json({ error: 'Errore transazione (riprova)' }, { status: 409 })
  }

  // Forgia: consuma le copie e marca GOLD. Guardia sul contatore per le corse
  // (se un'altra richiesta ha già consumato copie, qui non matcha → refund).
  const { data: forged, error: forgeErr } = await supabase
    .from('player_creatures')
    .update({ duplicates_count: pc.duplicates_count - GOLD_FORGE_COPIES, is_gold: true })
    .eq('id', playerCreatureId)
    .eq('duplicates_count', pc.duplicates_count)
    .eq('is_gold', false)
    .select('id')
  if (forgeErr || !forged || forged.length === 0) {
    await supabase.from('player_sessions').update({ gemme: balance }).eq('id', ps.id) // refund
    return NextResponse.json({ error: 'Forgiatura fallita (riprova)' }, { status: 409 })
  }

  const creatureName = ((pc as { creature?: { name?: string } | Array<{ name?: string }> }).creature as any)?.name
    ?? (Array.isArray((pc as any).creature) ? (pc as any).creature[0]?.name : null)

  const admin = createAdminClient()
  admin.from('player_game_events').insert({
    user_id: user.id, session_id: sessionId, type: 'gold_forged',
    payload: { creature_name: creatureName ?? '', gemme_spent: GOLD_FORGE_GEMME } as Json,
  }).then(undefined, () => {})

  return NextResponse.json({
    success: true,
    creatureName,
    remainingGemme: balance - GOLD_FORGE_GEMME,
    remainingCopies: pc.duplicates_count - GOLD_FORGE_COPIES,
  })
}
