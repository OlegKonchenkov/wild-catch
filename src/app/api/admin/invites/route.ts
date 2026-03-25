import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { sessionId, quantity } = await request.json()
  if (!sessionId || !quantity || quantity < 1 || quantity > 500) {
    return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })
  }

  const admin = createAdminClient()
  const codes: string[] = []
  const existing = new Set<string>()

  const { data: existingCodes } = await admin
    .from('session_invites').select('code').eq('session_id', sessionId)
  existingCodes?.forEach(c => existing.add(c.code))

  const maxAttempts = quantity * 10
  let attempts = 0
  while (codes.length < quantity && attempts < maxAttempts) {
    attempts++
    const code = generateCode()
    if (!existing.has(code)) { codes.push(code); existing.add(code) }
  }

  if (codes.length < quantity) {
    return NextResponse.json({ error: 'Impossibile generare codici sufficienti' }, { status: 500 })
  }

  const invites = codes.map(code => ({ session_id: sessionId, code }))
  const { data, error } = await admin.from('session_invites').insert(invites).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ codes, count: data?.length ?? 0 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.from('session_invites').select('*')
    .eq('session_id', sessionId).order('created_at', { ascending: false })
  return NextResponse.json({ invites: data ?? [] })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { inviteId } = await request.json()
  if (!inviteId) return NextResponse.json({ error: 'inviteId richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('session_invites').update({ is_active: false }).eq('id', inviteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ revoked: true })
}

// PATCH /api/admin/invites — reset a used invite code (make it available again)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { inviteId } = await request.json()
  if (!inviteId) return NextResponse.json({ error: 'inviteId richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('session_invites')
    .update({ used_by_user_id: null, is_active: true })
    .eq('id', inviteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reset: true })
}
