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

const DEFAULTS = {
  comune_rate: 0.70,
  non_comune_rate: 0.45,
  raro_rate: 0.25,
  epico_rate: 0.12,
  leggendario_rate: 0.05,
  mitologico_rate: 0.0125,
  non_comune_level_bonus: 0,
  raro_level_bonus: 0,
  epico_level_bonus: 0,
  leggendario_level_bonus: 0,
  mitologico_level_bonus: 0,
}

// GET /api/admin/catch-config
export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const admin = createAdminClient()
  const { data } = await admin
    .from('global_catch_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  return NextResponse.json({ config: data ?? { id: 1, ...DEFAULTS } })
}

// PUT /api/admin/catch-config
export async function PUT(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const body = await request.json().catch(() => ({}))

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('global_catch_config')
    .upsert({
      id: 1,
      comune_rate:             Math.min(1, Math.max(0, Number(body.comune_rate)             ?? DEFAULTS.comune_rate)),
      non_comune_rate:         Math.min(1, Math.max(0, Number(body.non_comune_rate)         ?? DEFAULTS.non_comune_rate)),
      raro_rate:               Math.min(1, Math.max(0, Number(body.raro_rate)               ?? DEFAULTS.raro_rate)),
      epico_rate:              Math.min(1, Math.max(0, Number(body.epico_rate)              ?? DEFAULTS.epico_rate)),
      leggendario_rate:        Math.min(1, Math.max(0, Number(body.leggendario_rate)        ?? DEFAULTS.leggendario_rate)),
      mitologico_rate:         Math.min(1, Math.max(0, Number(body.mitologico_rate)         ?? DEFAULTS.mitologico_rate)),
      non_comune_level_bonus:  Math.min(0.1, Math.max(0, Number(body.non_comune_level_bonus)  ?? 0)),
      raro_level_bonus:        Math.min(0.1, Math.max(0, Number(body.raro_level_bonus)        ?? 0)),
      epico_level_bonus:       Math.min(0.1, Math.max(0, Number(body.epico_level_bonus)       ?? 0)),
      leggendario_level_bonus: Math.min(0.1, Math.max(0, Number(body.leggendario_level_bonus) ?? 0)),
      mitologico_level_bonus:  Math.min(0.1, Math.max(0, Number(body.mitologico_level_bonus)  ?? 0)),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
