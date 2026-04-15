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

// PATCH /api/admin/session-pins/[id]
// body: { name, description }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { name, description, image_url } = body

  const admin = createAdminClient()
  const { reward_type, reward_payload, reward_radius_m } = body
  const { data, error } = await admin
    .from('session_map_pins')
    .update({
      name: name ?? '',
      description: description ?? '',
      ...(image_url !== undefined ? { image_url: image_url ?? null } : {}),
      ...(reward_type !== undefined ? { reward_type: reward_type ?? null } : {}),
      ...(reward_payload !== undefined ? { reward_payload: reward_payload ?? null } : {}),
      ...(reward_radius_m !== undefined ? { reward_radius_m: reward_radius_m ?? 50 } : {}),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pin: data })
}

// DELETE /api/admin/session-pins/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin
    .from('session_map_pins')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
