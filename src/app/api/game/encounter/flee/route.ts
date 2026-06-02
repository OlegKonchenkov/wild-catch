import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('encounter_act', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const body = await request.json().catch(() => ({}))
  const { encounterId } = body
  if (!encounterId) return NextResponse.json({ error: 'encounterId mancante' }, { status: 400 })

  await supabase
    .from('encounters')
    .update({ status: 'fled', resolved_at: new Date().toISOString() })
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')

  return NextResponse.json({ ok: true })
}
