import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const VALID_TYPES = ['oggetto', 'indizio', 'uovo', 'boss', 'evento'] as const

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

  const { sessionId, type, payload, usesRemaining, label } = await request.json()
  if (!sessionId || !type || !payload) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo QR non valido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('qr_codes').insert({
    session_id: sessionId, type, payload, uses_remaining: usesRemaining ?? null, label,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ qrCode: data })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.from('qr_codes').select('*')
    .eq('session_id', sessionId).order('created_at', { ascending: false })
  return NextResponse.json({ qrCodes: data ?? [] })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { qrId, type, payload, usesRemaining, label } = await request.json()
  if (!qrId || !type || !payload) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo QR non valido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('qr_codes')
    .update({
      type,
      payload,
      uses_remaining: usesRemaining ?? null,
      label: label ?? '',
    })
    .eq('id', qrId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ qrCode: data })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { qrId } = await request.json()
  if (!qrId) return NextResponse.json({ error: 'qrId richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('qr_codes').delete().eq('id', qrId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
