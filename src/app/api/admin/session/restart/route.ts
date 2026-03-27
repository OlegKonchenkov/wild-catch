import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { sessionId } = await request.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const admin = createAdminClient()

  // Reset session to draft — clear timing and status
  const { error } = await admin.from('sessions').update({
    status: 'draft',
    start_at: null,
    end_at: null,
  }).eq('id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify connected players that the session is being restarted
  const channel = admin.channel(`session:${sessionId}`)
  await new Promise<void>(resolve => channel.subscribe(() => resolve()))
  await channel.send({
    type: 'broadcast',
    event: 'session_restarted',
    payload: { sessionId },
  })
  await admin.removeChannel(channel)

  return NextResponse.json({ restarted: true })
}
