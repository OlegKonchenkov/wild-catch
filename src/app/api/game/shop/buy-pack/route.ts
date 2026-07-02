import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispenseReward } from '@/lib/game/rewards/dispense'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { isTutorialSession } from '@/lib/game/tutorial'

// POST /api/game/shop/buy-pack — body: { packId, sessionId, currency: 'gold'|'gemme' }
// Buys one bustina with gold or gemme. Optimistic-locked deduction, then grants
// the pack via the shared dispenser. Gives gemme a real spending sink.
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('shop_buy', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const { packId, sessionId, currency } = await request.json().catch(() => ({}))
  if (!packId || !sessionId) return NextResponse.json({ error: 'packId e sessionId richiesti' }, { status: 400 })
  const cur: 'gold' | 'gemme' = currency === 'gemme' ? 'gemme' : 'gold'

  const { data: sessionCheck } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'La sessione non è attiva' }, { status: 403 })
  }
  // Tutorial is isolated — bustine there come from the guided missions, not the shop.
  if (isTutorialSession(sessionId)) {
    return NextResponse.json({ error: 'Le bustine non sono in vendita nel tutorial' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: pack } = await admin.from('packs').select('id, name, price_gold, price_gemme').eq('id', packId).single()
  if (!pack) return NextResponse.json({ error: 'Bustina non trovata' }, { status: 404 })

  const price = cur === 'gold' ? pack.price_gold : pack.price_gemme
  if (price == null || price <= 0) {
    return NextResponse.json({ error: `Questa bustina non è acquistabile in ${cur === 'gold' ? 'oro' : 'gemme'}` }, { status: 400 })
  }

  const { data: ps } = await supabase
    .from('player_sessions').select('id, gold, gemme')
    .eq('user_id', user.id).eq('session_id', sessionId).single()
  if (!ps) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  const balance = cur === 'gold' ? ps.gold : (ps as { gemme: number }).gemme
  if (balance < price) {
    return NextResponse.json({ error: cur === 'gold' ? 'Oro insufficiente' : 'Gemme insufficienti' }, { status: 402 })
  }

  // Optimistic-locked deduction
  const newBalance = balance - price
  const { data: upd, error: updErr } = await supabase
    .from('player_sessions')
    .update({ [cur]: newBalance })
    .eq('id', ps.id)
    .eq(cur, balance)
    .select('id')
  if (updErr || !upd || upd.length === 0) {
    return NextResponse.json({ error: 'Errore transazione (riprova)' }, { status: 409 })
  }

  // Grant the pack
  const res = await dispenseReward(admin, { userId: user.id, sessionId, type: 'bustina', payload: { pack_id: packId, quantity: 1 } })
  if (!res.ok) {
    // Refund on grant failure
    await supabase.from('player_sessions').update({ [cur]: balance }).eq('id', ps.id)
    return NextResponse.json({ error: 'Errore consegna bustina' }, { status: 500 })
  }

  return NextResponse.json({
    success: true, packName: pack.name, currency: cur,
    remainingGold: cur === 'gold' ? newBalance : ps.gold,
    remainingGemme: cur === 'gemme' ? newBalance : (ps as { gemme: number }).gemme,
  })
}
