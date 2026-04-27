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

// GET /api/admin/session-pins?sessionId=...
export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_map_pins')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pins: data })
}

// POST /api/admin/session-pins
// body: { sessionId, lat, lng, name, description }
export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { sessionId, lat, lng, name, description, image_url, reward_type, reward_payload, reward_radius_m } = await request.json().catch(() => ({}))
  if (!sessionId || lat == null || lng == null) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_map_pins')
    .insert({
      session_id: sessionId, lat, lng,
      name: name ?? '', description: description ?? '',
      image_url: image_url ?? null,
      ...(reward_type != null ? { reward_type: reward_type ?? null } : {}),
      ...(reward_payload != null ? { reward_payload: reward_payload ?? null } : {}),
      ...(reward_radius_m != null ? { reward_radius_m: reward_radius_m ?? 50 } : {}),
      ...(reward_type === 'enigma' && reward_payload?.enigma_id ? { enigma_id: reward_payload.enigma_id } : {}),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pin: data })
}
