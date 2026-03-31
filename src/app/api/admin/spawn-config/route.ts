import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

// GET /api/admin/spawn-config?sessionId=xxx
export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('session_spawn_config')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()

  return NextResponse.json({
    config: data ?? {
      session_id: sessionId,
      non_comune_bonus: 0.02,
      raro_bonus: 0.10,
      epico_bonus: 0.20,
      leggendario_bonus: 0.40,
    },
  })
}

// PUT /api/admin/spawn-config — upsert
export async function PUT(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const body = await request.json().catch(() => ({}))
  const { sessionId, non_comune_bonus, raro_bonus, epico_bonus, leggendario_bonus } = body

  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_spawn_config')
    .upsert({
      session_id: sessionId,
      non_comune_bonus: Number(non_comune_bonus) ?? 0.02,
      raro_bonus: Number(raro_bonus) ?? 0.10,
      epico_bonus: Number(epico_bonus) ?? 0.20,
      leggendario_bonus: Number(leggendario_bonus) ?? 0.40,
    }, { onConflict: 'session_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
