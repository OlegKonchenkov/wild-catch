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

// GET /api/admin/enigmi/[id]
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('enigmi')
    .select('*, frammenti:enigma_frammenti(*), suggerimenti:enigma_suggerimenti(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })

  const enigma = {
    ...data,
    frammenti: (data.frammenti ?? []).sort((a: any, b: any) => a.order_index - b.order_index),
    suggerimenti: (data.suggerimenti ?? []).sort((a: any, b: any) => a.order_index - b.order_index),
  }

  return NextResponse.json({ enigma })
}

// PATCH /api/admin/enigmi/[id]
// body: any subset of enigma fields; when frammenti/suggerimenti arrays are present, full replace
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { title, description, solution, difficulty, reward_type, reward_payload, lock_config } = body

  const admin = createAdminClient()

  // Update enigma fields (only those present in body)
  const updatePayload = {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description: description ?? null } : {}),
    ...(solution !== undefined ? { solution } : {}),
    ...(difficulty !== undefined ? { difficulty } : {}),
    ...(reward_type !== undefined ? { reward_type: reward_type ?? null } : {}),
    ...(reward_payload !== undefined ? { reward_payload: reward_payload ?? null } : {}),
    ...(lock_config !== undefined ? { lock_config: lock_config ?? null } : {}),
  }

  let enigma: any
  if (Object.keys(updatePayload).length > 0) {
    const { data, error } = await admin
      .from('enigmi')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
    enigma = data
  } else {
    // No scalar fields to update — fetch the current record
    const { data, error } = await admin
      .from('enigmi')
      .select()
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
    enigma = data
  }

  let frammenti: any[] = []
  let suggerimenti: any[] = []

  // Non-atomic: delete then insert. If insert fails after delete, sub-entities are lost.
  // Admin-only context; acceptable risk until a stored procedure handles atomicity.
  if (Array.isArray(body.frammenti)) {
    const { error: delError } = await admin
      .from('enigma_frammenti')
      .delete()
      .eq('enigma_id', id)
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

    if (body.frammenti.length > 0) {
      const rows = body.frammenti.map((f: any) => ({
        enigma_id: id,
        title: f.title,
        description: f.description ?? null,
        image_url: f.image_url ?? null,
        video_url: f.video_url ?? null,
        order_index: f.order_index ?? 0,
      }))
      const { data: framData, error: framError } = await admin
        .from('enigma_frammenti')
        .insert(rows)
        .select()
      if (framError) return NextResponse.json({ error: framError.message }, { status: 500 })
      frammenti = (framData ?? []).sort((a: any, b: any) => a.order_index - b.order_index)
    }
  } else {
    // Fetch existing frammenti to include in response
    const { data: framData } = await admin
      .from('enigma_frammenti')
      .select()
      .eq('enigma_id', id)
      .order('order_index', { ascending: true })
    frammenti = framData ?? []
  }

  // Non-atomic: same caveat as frammenti replace above.
  if (Array.isArray(body.suggerimenti)) {
    const { error: delError } = await admin
      .from('enigma_suggerimenti')
      .delete()
      .eq('enigma_id', id)
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

    if (body.suggerimenti.length > 0) {
      const rows = body.suggerimenti.map((s: any) => ({
        enigma_id: id,
        text: s.text,
        image_url: s.image_url ?? null,
        order_index: s.order_index ?? 0,
      }))
      const { data: suggData, error: suggError } = await admin
        .from('enigma_suggerimenti')
        .insert(rows)
        .select()
      if (suggError) return NextResponse.json({ error: suggError.message }, { status: 500 })
      suggerimenti = (suggData ?? []).sort((a: any, b: any) => a.order_index - b.order_index)
    }
  } else {
    // Fetch existing suggerimenti to include in response
    const { data: suggData } = await admin
      .from('enigma_suggerimenti')
      .select()
      .eq('enigma_id', id)
      .order('order_index', { ascending: true })
    suggerimenti = suggData ?? []
  }

  return NextResponse.json({ enigma: { ...enigma, frammenti, suggerimenti } })
}

// DELETE /api/admin/enigmi/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin
    .from('enigmi')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
