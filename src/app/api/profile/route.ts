import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/profile
export async function GET() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, gdpr_consent_at, updated_at, created_at')
    .eq('user_id', user.id)
    .single()

  // No Cache-Control. The client (/home) reads this immediately after a PUT
  // that saves the nickname/GDPR consent. A browser cache here served the
  // pre-save value on reopen, so the app kept re-prompting for a nickname that
  // was actually already saved ("nickname non si salva" bug). Always serve
  // fresh — on NANO the saving from caching this is negligible anyway.
  return NextResponse.json({
    nickname:     data?.nickname ?? null,
    avatarUrl:    data?.avatar_url ?? (user.user_metadata as any)?.avatar_url ?? null,
    email:        user.email,
    gdprAccepted: !!data?.gdpr_consent_at,
    createdAt:    data?.created_at ?? null,
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
