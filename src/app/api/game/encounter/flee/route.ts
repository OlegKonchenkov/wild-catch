import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

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
