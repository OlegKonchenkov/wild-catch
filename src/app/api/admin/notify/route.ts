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

  const { sessionId, title, message } = await request.json()
  if (!sessionId || !title || !message) {
    return NextResponse.json({ error: 'sessionId, title e message sono richiesti' }, { status: 400 })
  }

  const admin = createAdminClient()
  const channel = admin.channel(`session:${sessionId}`)
  await new Promise<void>(resolve => channel.subscribe(() => resolve()))
  await channel.send({
    type: 'broadcast',
    event: 'admin_notify',
    payload: { title, message, sentAt: new Date().toISOString() },
  })
  await admin.removeChannel(channel)

  return NextResponse.json({ sent: true })
}
