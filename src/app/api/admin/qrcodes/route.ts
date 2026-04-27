import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const VALID_TYPES = ['oggetto', 'indizio', 'uovo', 'boss', 'evento', 'creatura'] as const
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I

function generateCode(): string {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}

function sanitizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
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

  const { sessionId, type, payload, usesRemaining, label, uniquePerUser, manualCode } = await request.json()
  if (!type || !payload) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo QR non valido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Determine manual_code: use provided or generate unique one
  let code = manualCode ? sanitizeCode(manualCode) : generateCode()
  if (code.length < 1) code = generateCode()

  // Ensure uniqueness (up to 10 tries for generated codes)
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: existing } = await admin.from('qr_codes').select('id').eq('manual_code', code).maybeSingle()
    if (!existing) break
    if (manualCode) return NextResponse.json({ error: `Codice "${code}" già in uso` }, { status: 409 })
    code = generateCode()
  }

  const { data, error } = await admin.from('qr_codes').insert({
    session_id: sessionId ?? null,
    type,
    payload,
    uses_remaining: usesRemaining ?? null,
    label,
    unique_per_user: uniquePerUser ?? false,
    manual_code: code,
    ...(type === 'indizio' && payload?.suggerimento_id ? { enigma_suggerimento_id: payload.suggerimento_id } : {}),
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

  const admin = createAdminClient()
  let query = admin.from('qr_codes').select('*').order('created_at', { ascending: false })
  if (sessionId && sessionId !== 'all') {
    query = query.eq('session_id', sessionId)
  }
  const { data } = await query
  return NextResponse.json({ qrCodes: data ?? [] })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { qrId, type, payload, usesRemaining, label, uniquePerUser, sessionId, manualCode } = await request.json()
  if (!qrId || !type || !payload) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo QR non valido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const updatePayload: Record<string, unknown> = {
    type,
    payload,
    uses_remaining: usesRemaining ?? null,
    label: label ?? '',
    unique_per_user: uniquePerUser ?? false,
  }
  if (sessionId !== undefined) updatePayload.session_id = sessionId ?? null

  // Update enigma_suggerimento_id for indizio type
  if (type === 'indizio' && payload?.suggerimento_id) {
    updatePayload.enigma_suggerimento_id = payload.suggerimento_id
  } else if (type !== 'indizio') {
    updatePayload.enigma_suggerimento_id = null
  }

  // Update manual_code if provided
  if (manualCode !== undefined) {
    const code = sanitizeCode(String(manualCode))
    if (code.length < 1) return NextResponse.json({ error: 'Codice non valido' }, { status: 400 })
    // Check uniqueness (exclude current row)
    const { data: existing } = await admin.from('qr_codes').select('id').eq('manual_code', code).neq('id', qrId).maybeSingle()
    if (existing) return NextResponse.json({ error: `Codice "${code}" già in uso` }, { status: 409 })
    updatePayload.manual_code = code
  }

  const { data, error } = await admin
    .from('qr_codes')
    .update(updatePayload)
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
