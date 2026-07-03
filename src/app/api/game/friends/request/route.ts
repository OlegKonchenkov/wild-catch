import { NextResponse, after } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser, getDisplayName } from '@/lib/push'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

// POST /api/game/friends/request — body: { nickname }
// Invia una richiesta di amicizia cercando il nickname esatto (case-insensitive).
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('friend_request', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const { nickname } = await request.json().catch(() => ({}))
  if (!nickname?.trim()) return NextResponse.json({ error: 'nickname richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('user_id, nickname')
    .ilike('nickname', nickname.trim())
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ error: `Nessun giocatore trovato con il nickname "${nickname.trim()}"` }, { status: 404 })
  }
  if (target.user_id === user.id) {
    return NextResponse.json({ error: 'Non puoi aggiungere te stesso' }, { status: 400 })
  }

  // Nessun duplicato nei due versi (pending o già amici)
  const { data: existing } = await admin
    .from('friendships')
    .select('id, status')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${target.user_id}),and(requester_id.eq.${target.user_id},addressee_id.eq.${user.id})`)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({
      error: existing.status === 'accepted' ? 'Siete già amici!' : 'C\'è già una richiesta in sospeso',
      alreadyExists: true,
    }, { status: 409 })
  }

  const { error: insErr } = await supabase.from('friendships').insert({
    requester_id: user.id, addressee_id: target.user_id,
  })
  if (insErr) {
    if (insErr.code === '23505') return NextResponse.json({ error: 'Richiesta già inviata' }, { status: 409 })
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  after(async () => {
    const myName = await getDisplayName(user.id)
    await sendPushToUser(target.user_id, {
      title: '🤝 Nuova richiesta di amicizia',
      body: `${myName ?? 'Un giocatore'} vuole diventare tuo amico. Apri il Profilo per rispondere.`,
      url: '/game/profile',
      tag: `friend_req_${user.id}`,
    })
  })

  return NextResponse.json({ success: true, nickname: target.nickname })
}
