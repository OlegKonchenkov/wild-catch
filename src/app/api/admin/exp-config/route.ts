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

// GET /api/admin/exp-config — return full level EXP ladder
export async function GET() {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const admin = createAdminClient()
  const { data } = await admin
    .from('level_exp_config')
    .select('level, exp_to_next')
    .order('level')

  return NextResponse.json({ config: data ?? [] })
}

// PUT /api/admin/exp-config — upsert one row { level, exp_to_next }
export async function PUT(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const body = await request.json().catch(() => ({}))
  const level = Number(body.level)
  const exp_to_next = Number(body.exp_to_next)

  if (!level || level < 1 || !exp_to_next || exp_to_next < 1) {
    return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('level_exp_config')
    .upsert({ level, exp_to_next }, { onConflict: 'level' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}
