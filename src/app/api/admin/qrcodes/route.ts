import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  if (auth && 'error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { sessionId, type, payload, usesRemaining, label } = await request.json()

  const { data, error } = await supabase.from('qr_codes').insert({
    session_id: sessionId, type, payload, uses_remaining: usesRemaining ?? null, label,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ qrCode: data })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if (auth && 'error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const { data } = await supabase.from('qr_codes').select('*')
    .eq('session_id', sessionId).order('created_at', { ascending: false })
  return NextResponse.json({ qrCodes: data ?? [] })
}
