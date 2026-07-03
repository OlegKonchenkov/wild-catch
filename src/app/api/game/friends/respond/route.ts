import { NextResponse, after } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { sendPushToUser, getDisplayName } from '@/lib/push'

// POST /api/game/friends/respond — body: { friendshipId, accept }
// Solo l'addressee risponde: accetta (status accepted) o rifiuta (delete).
// Il requester può usare questa route con accept=false per annullare la
// propria richiesta (la RLS delete lo consente).
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { friendshipId, accept } = await request.json().catch(() => ({}))
  if (!friendshipId || accept === undefined) {
    return NextResponse.json({ error: 'friendshipId e accept richiesti' }, { status: 400 })
  }

  const { data: row } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('id', friendshipId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Richiesta non trovata' }, { status: 404 })

  if (accept) {
    if (row.addressee_id !== user.id) {
      return NextResponse.json({ error: 'Solo il destinatario può accettare' }, { status: 403 })
    }
    if (row.status === 'accepted') return NextResponse.json({ success: true, alreadyAccepted: true })
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', friendshipId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    after(async () => {
      const myName = await getDisplayName(user.id)
      await sendPushToUser(row.requester_id, {
        title: '🤝 Richiesta accettata!',
        body: `${myName ?? 'Un giocatore'} ha accettato la tua amicizia.`,
        url: '/game/profile',
        tag: `friend_ok_${user.id}`,
      })
    })
    return NextResponse.json({ success: true })
  }

  // Rifiuto (addressee) o annullamento (requester) → delete
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, removed: true })
}
