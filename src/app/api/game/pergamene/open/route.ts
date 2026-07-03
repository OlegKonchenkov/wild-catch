import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispenseReward, type DispenseResult } from '@/lib/game/rewards/dispense'
import { isTutorialSession } from '@/lib/game/tutorial'
import type { Json } from '@/types/database'

/** Gemme che accompagnano ogni pergamena aperta. */
const PERGAMENA_GEMME = 3
/** Oro di consolazione quando il giocatore possiede già tutti gli aneddoti. */
const PERGAMENA_FALLBACK_GOLD = 10

// POST /api/game/pergamene/open — body: { sessionId }
// Apre la pergamena non aperta più vecchia: rivela un aneddoto casuale non
// posseduto (+ gemme); se la collezione aneddoti è completa → oro + gemme.
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId } = await request.json().catch(() => ({}))
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const { data: sessionCheck } = await supabase
    .from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'Sessione non attiva' }, { status: 403 })
  }

  // La pergamena più vecchia non ancora aperta
  const { data: pergamena } = await supabase
    .from('player_pergamene')
    .select('id')
    .eq('user_id', user.id).eq('session_id', sessionId)
    .is('opened_at', null)
    .order('earned_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!pergamena) {
    return NextResponse.json({ error: 'Nessuna pergamena da aprire — cammina per trovarne!' }, { status: 404 })
  }

  // Claim atomico: marca opened_at solo se ancora nullo (doppio tap → 409)
  const { data: claimed } = await supabase
    .from('player_pergamene')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', pergamena.id)
    .is('opened_at', null)
    .select('id')
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Pergamena già aperta', alreadyOpened: true }, { status: 409 })
  }

  const admin = createAdminClient()

  // Aneddoto casuale non posseduto (scoped: sessione+globali; tutorial isolato)
  const anecBase = admin.from('anecdotes').select('id, title')
  // Gli aneddoti non hanno session_id — il catalogo è globale; nel tutorial
  // le pergamene non maturano comunque (nessun luogo culturale nel percorso).
  const { data: allAnecdotes } = await anecBase
  const { data: owned } = await supabase
    .from('player_collection')
    .select('ref_id')
    .eq('user_id', user.id).eq('session_id', sessionId).eq('kind', 'aneddoto')
  const ownedIds = new Set((owned ?? []).map((r: { ref_id: string }) => r.ref_id))
  const candidates = (allAnecdotes ?? []).filter((a: { id: string }) => !ownedIds.has(a.id))

  const drops: DispenseResult[] = []
  if (candidates.length > 0 && !isTutorialSession(sessionId)) {
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    drops.push(await dispenseReward(admin, {
      userId: user.id, sessionId, type: 'aneddoto', payload: { anecdote_id: pick.id },
    }))
  } else {
    drops.push(await dispenseReward(admin, {
      userId: user.id, sessionId, type: 'gold', payload: { amount: PERGAMENA_FALLBACK_GOLD },
    }))
  }
  drops.push(await dispenseReward(admin, {
    userId: user.id, sessionId, type: 'gemme', payload: { amount: PERGAMENA_GEMME },
  }))

  admin.from('player_game_events').insert({
    user_id: user.id, session_id: sessionId, type: 'pergamena_opened',
    payload: { drop_count: drops.length } as Json,
  }).then(undefined, () => {})

  return NextResponse.json({ success: true, drops: drops.filter(d => d.ok) })
}
