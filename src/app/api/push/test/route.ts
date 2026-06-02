import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { sendPushToUser } from '@/lib/push'

// Sends a test push to the calling user's own devices — used by the
// "Invia notifica di prova" button to verify end-to-end delivery.
export async function POST() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  await sendPushToUser(user.id, {
    title: '🔔 Notifiche attive!',
    body: 'Questa è una notifica di prova: tutto funziona correttamente.',
    url: '/game/map',
    tag: 'push_test',
  })

  return NextResponse.json({ ok: true })
}
