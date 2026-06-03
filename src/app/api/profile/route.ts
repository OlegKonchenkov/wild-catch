import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/profile
export async function GET() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Only select columns that actually exist on `profiles` (migration 006:
  // user_id, nickname, avatar_url, gdpr_consent_at, gdpr_consent_minor,
  // updated_at). The previous select asked for a non-existent `created_at`
  // column, which made PostgREST fail the whole query — `data` came back null
  // and the route returned `nickname: null` on EVERY call. That, not caching,
  // was the real "il nickname non si salva" bug: the PUT persisted fine but the
  // GET could never read it back, so /home kept showing the "set nickname"
  // prompt. Surface the error instead of silently swallowing it.
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, gdpr_consent_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // No Cache-Control: /home reads this right after the PUT that saves the
  // nickname/GDPR consent, so it must always be fresh.
  return NextResponse.json({
    nickname:     data?.nickname ?? null,
    avatarUrl:    data?.avatar_url ?? (user.user_metadata as any)?.avatar_url ?? null,
    email:        user.email,
    gdprAccepted: !!data?.gdpr_consent_at,
  })
}

// PUT /api/profile — update nickname (and optionally mark GDPR)
export async function PUT(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  // PUT keeps using the JWT-derived user since we only need user.id for the upsert.

  const body = await request.json().catch(() => ({}))
  const { nickname, acceptGdpr } = body

  if (nickname !== undefined) {
    const trimmed = String(nickname).trim()
    if (trimmed.length < 2 || trimmed.length > 24) {
      return NextResponse.json({ error: 'Nickname: 2-24 caratteri' }, { status: 400 })
    }
    // Basic profanity/safety: no special chars except _ -
    if (!/^[\w\s\-_.àèìòùáéíóúÀÈÌÒÙ]+$/u.test(trimmed)) {
      return NextResponse.json({ error: 'Nickname: solo lettere, numeri e _ - .' }, { status: 400 })
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (nickname !== undefined) updates.nickname = String(nickname).trim()
  if (acceptGdpr)             updates.gdpr_consent_at = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/profile — permanently delete account. Uses strict getUser() since
// we want to be 100% sure the session is still valid before nuking the account.
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Requires service role key to delete auth user
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
