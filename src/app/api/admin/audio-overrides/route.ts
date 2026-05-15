import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SLOTS = ['map', 'encounter', 'duel', 'boss', 'intro'] as const
type Slot = (typeof SLOTS)[number]

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, msg: 'Non autenticato' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { ok: false as const, status: 403, msg: 'Non autorizzato' }
  return { ok: true as const }
}

/**
 * List all audio overrides. Optional ?sessionId filter — empty means "all".
 * The admin UI uses no filter so it can render both global and per-session
 * rows side by side.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.msg }, { status: guard.status })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  const admin = createAdminClient()
  let q = admin
    .from('audio_overrides')
    .select('id, session_id, slot, file_url, file_name, enabled, updated_at')
    .order('updated_at', { ascending: false })

  if (sessionId === 'global') q = q.is('session_id', null)
  else if (sessionId) q = q.eq('session_id', sessionId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ overrides: data })
}

/**
 * Upsert an override row for (session_id, slot). Body:
 *   { sessionId: string | null, slot: Slot, fileUrl: string, fileName?: string }
 *
 * Re-posting the same (session_id, slot) replaces the previous file URL —
 * the admin UI uses this to swap a freshly-uploaded file in without forcing
 * a separate delete step.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.msg }, { status: guard.status })

  const body = await request.json().catch(() => ({}))
  const { sessionId, slot, fileUrl, fileName } = body as {
    sessionId?: string | null
    slot?: string
    fileUrl?: string
    fileName?: string
  }

  if (!slot || !SLOTS.includes(slot as Slot)) {
    return NextResponse.json({ error: `slot deve essere uno tra: ${SLOTS.join(', ')}` }, { status: 400 })
  }
  if (!fileUrl || typeof fileUrl !== 'string') {
    return NextResponse.json({ error: 'fileUrl mancante' }, { status: 400 })
  }

  const admin = createAdminClient()
  // Manual upsert: partial unique indices don't play with `onConflict` for
  // both the global-NULL and per-session cases, so we do find+update / insert.
  const existingQuery = admin
    .from('audio_overrides')
    .select('id')
    .eq('slot', slot)
  const existing = sessionId
    ? await existingQuery.eq('session_id', sessionId).maybeSingle()
    : await existingQuery.is('session_id', null).maybeSingle()

  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 })

  if (existing.data) {
    const { data, error } = await admin
      .from('audio_overrides')
      .update({ file_url: fileUrl, file_name: fileName ?? null, enabled: true })
      .eq('id', existing.data.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ override: data })
  }

  const { data, error } = await admin
    .from('audio_overrides')
    .insert({
      session_id: sessionId ?? null,
      slot,
      file_url: fileUrl,
      file_name: fileName ?? null,
      enabled: true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ override: data })
}
