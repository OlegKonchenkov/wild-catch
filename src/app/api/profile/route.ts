import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// GET /api/profile
export async function GET() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, gdpr_consent_at, updated_at')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    nickname:     data?.nickname ?? null,
    avatarUrl:    data?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    email:        user.email,
    gdprAccepted: !!data?.gdpr_consent_at,
    createdAt:    user.created_at,
  })
}

// PUT /api/profile — update nickname (and optionally mark GDPR)
export async function PUT(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

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

// DELETE /api/profile — permanently delete account
export async function DELETE() {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Requires service role key to delete auth user
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
