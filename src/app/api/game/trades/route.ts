import { NextResponse, after } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser, getDisplayName } from '@/lib/push'
import type { Json } from '@/types/database'

// GET /api/game/trades?sessionId=... → proposte pending in/out con nomi
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const { data: rows } = await supabase
    .from('trades')
    .select('id, proposer_id, recipient_id, proposer_creature_id, recipient_creature_id, status')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .or(`proposer_id.eq.${user.id},recipient_id.eq.${user.id}`)

  const all = rows ?? []
  if (all.length === 0) return NextResponse.json({ incoming: [], outgoing: [] })

  const admin = createAdminClient()
  const userIds = [...new Set(all.flatMap(t => [t.proposer_id, t.recipient_id]))]
  const creatureIds = [...new Set(all.flatMap(t => [t.proposer_creature_id, t.recipient_creature_id]))]
  const [{ data: profs }, { data: crs }] = await Promise.all([
    admin.from('profiles').select('user_id, nickname').in('user_id', userIds),
    admin.from('creatures').select('id, name, rarity, sprite_url, image_url').in('id', creatureIds),
  ])
  const nameById = new Map((profs ?? []).map(p => [p.user_id, p.nickname]))
  const crById = new Map((crs ?? []).map(c => [c.id, c]))

  const enrich = (t: typeof all[number]) => ({
    id: t.id,
    otherNickname: nameById.get(t.proposer_id === user.id ? t.recipient_id : t.proposer_id) ?? 'Giocatore',
    give: crById.get(t.proposer_id === user.id ? t.proposer_creature_id : t.recipient_creature_id) ?? null,
    get: crById.get(t.proposer_id === user.id ? t.recipient_creature_id : t.proposer_creature_id) ?? null,
  })

  return NextResponse.json({
    incoming: all.filter(t => t.recipient_id === user.id).map(enrich),
    outgoing: all.filter(t => t.proposer_id === user.id).map(enrich),
  })
}

// POST /api/game/trades — body: { friendId, offerCreatureId, requestCreatureId, sessionId }
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { friendId, offerCreatureId, requestCreatureId, sessionId } = await request.json().catch(() => ({}))
  if (!friendId || !offerCreatureId || !requestCreatureId || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Amicizia accettata richiesta
  const { data: friendship } = await admin
    .from('friendships').select('id').eq('status', 'accepted')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`)
    .maybeSingle()
  if (!friendship) return NextResponse.json({ error: 'Potete scambiare solo tra amici' }, { status: 403 })

  // Entrambi devono avere DOPPIONI delle rispettive creature in questa sessione
  const [{ data: mine }, { data: theirs }] = await Promise.all([
    admin.from('player_creatures').select('duplicates_count')
      .eq('user_id', user.id).eq('session_id', sessionId).eq('creature_id', offerCreatureId).maybeSingle(),
    admin.from('player_creatures').select('duplicates_count')
      .eq('user_id', friendId).eq('session_id', sessionId).eq('creature_id', requestCreatureId).maybeSingle(),
  ])
  if (!mine || mine.duplicates_count < 2) {
    return NextResponse.json({ error: 'Puoi offrire solo un doppione (ti resta sempre 1 copia)' }, { status: 422 })
  }
  if (!theirs || theirs.duplicates_count < 2) {
    return NextResponse.json({ error: 'Il tuo amico non ha un doppione di quella creatura' }, { status: 422 })
  }

  // Anti-spam: max 5 proposte pending in uscita
  const { count } = await admin.from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('proposer_id', user.id).eq('status', 'pending')
  if ((count ?? 0) >= 5) return NextResponse.json({ error: 'Hai già 5 proposte in sospeso' }, { status: 429 })

  const { data: trade, error } = await admin.from('trades').insert({
    session_id: sessionId, proposer_id: user.id, recipient_id: friendId,
    proposer_creature_id: offerCreatureId, recipient_creature_id: requestCreatureId,
  }).select('id').single()
  if (error || !trade) return NextResponse.json({ error: error?.message ?? 'Errore' }, { status: 500 })

  after(async () => {
    const myName = await getDisplayName(user.id)
    await sendPushToUser(friendId, {
      title: '⇄ Proposta di scambio!',
      body: `${myName ?? 'Un amico'} ti propone uno scambio di Daimon. Apri il Profilo.`,
      url: '/game/profile',
      tag: `trade_${trade.id}`,
    })
  })

  return NextResponse.json({ success: true, tradeId: trade.id })
}

// PATCH /api/game/trades — body: { tradeId, action: 'accept'|'decline'|'cancel' }
export async function PATCH(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { tradeId, action } = await request.json().catch(() => ({}))
  if (!tradeId || !['accept', 'decline', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'tradeId e action richiesti' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: trade } = await admin
    .from('trades')
    .select('id, proposer_id, recipient_id, status, session_id')
    .eq('id', tradeId).maybeSingle()
  if (!trade) return NextResponse.json({ error: 'Scambio non trovato' }, { status: 404 })
  if (trade.status !== 'pending') return NextResponse.json({ error: 'Scambio già concluso' }, { status: 409 })

  if (action === 'accept') {
    if (trade.recipient_id !== user.id) return NextResponse.json({ error: 'Solo il destinatario può accettare' }, { status: 403 })
    const { error } = await admin.rpc('execute_trade', { p_trade_id: tradeId, p_user_id: user.id })
    if (error) {
      const msg = error.message.includes('missing_duplicate')
        ? 'Uno dei due non ha più il doppione — scambio impossibile'
        : 'Scambio fallito, riprova'
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    admin.from('player_game_events').insert([
      { user_id: trade.proposer_id, session_id: trade.session_id, type: 'trade_completed', payload: {} as Json },
      { user_id: trade.recipient_id, session_id: trade.session_id, type: 'trade_completed', payload: {} as Json },
    ]).then(undefined, () => {})
    after(async () => {
      const myName = await getDisplayName(user.id)
      await sendPushToUser(trade.proposer_id, {
        title: '⇄ Scambio completato!',
        body: `${myName ?? 'Il tuo amico'} ha accettato lo scambio. Controlla il DaimonDex!`,
        url: '/game/bestiary',
        tag: `trade_ok_${tradeId}`,
      })
    })
    return NextResponse.json({ success: true, accepted: true })
  }

  // decline (recipient) / cancel (proposer)
  const allowed = action === 'decline' ? trade.recipient_id === user.id : trade.proposer_id === user.id
  if (!allowed) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  await admin.from('trades')
    .update({ status: action === 'decline' ? 'declined' : 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', tradeId)
  return NextResponse.json({ success: true })
}
