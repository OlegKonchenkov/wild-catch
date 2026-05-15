import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, msg: 'Non autenticato' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { ok: false as const, status: 403, msg: 'Non autorizzato' }
  return { ok: true as const }
}

/**
 * Toggle the `enabled` flag (or any subset of mutable fields). Body:
 *   { enabled?: boolean }
 *
 * Disabling instead of deleting lets the admin keep the uploaded file in
 * place and re-activate it later without re-uploading.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.msg }, { status: guard.status })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('audio_overrides')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ override: data })
}

/**
 * Removes the override row. Playback falls back to the default synth
 * (or, for the intro slot, to /audio/bgm.mp3 → silence).
 *
 * The uploaded file in storage is intentionally NOT deleted — same convention
 * as /admin/items (orphan files are cheap and let admins re-attach an old
 * upload without re-uploading).
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.msg }, { status: guard.status })
  const { id } = await ctx.params

  const admin = createAdminClient()
  const { error } = await admin.from('audio_overrides').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
