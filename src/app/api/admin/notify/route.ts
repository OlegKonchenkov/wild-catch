import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin')
  if (rpcError) return { error: 'Errore verifica ruolo', status: 500 }
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Accept both `message` and `body` for backward compatibility
  const raw = await request.json()
  const { sessionId, userId, title } = raw
  const message: string = raw.message ?? raw.body ?? ''

  if (!title || !message || (!sessionId && !userId)) {
    return NextResponse.json({ error: 'title, message e almeno sessionId o userId sono richiesti' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Persist notification(s) to player_notifications for history
  if (userId) {
    // Single-player notification
    const { data: ps } = await admin
      .from('player_sessions')
      .select('session_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const notifSessionId = sessionId ?? ps?.session_id
    if (notifSessionId) {
      await admin.from('player_notifications').insert({
        user_id: userId,
        session_id: notifSessionId,
        type: 'admin_notify',
        payload: { title, message },
      })
    }
  } else if (sessionId) {
    // Session-wide: insert for each player
    const { data: players } = await admin
      .from('player_sessions')
      .select('user_id')
      .eq('session_id', sessionId)
    if (players && players.length > 0) {
      await admin.from('player_notifications').insert(
        players.map((p: any) => ({
          user_id: p.user_id,
          session_id: sessionId,
          type: 'admin_notify',
          payload: { title, message },
        }))
      )
    }
  }

  // Also send realtime broadcast on the channel the GameShell subscribes to
  const channelName = userId ? `shell:user:${userId}` : `shell:session:${sessionId}`
  const channel = admin.channel(channelName)
  await new Promise<void>(resolve => channel.subscribe(() => resolve()))
  await channel.send({
    type: 'broadcast',
    event: 'admin_notify',
    payload: { title, message, sentAt: new Date().toISOString() },
  })
  await admin.removeChannel(channel)

  return NextResponse.json({ sent: true })
}
