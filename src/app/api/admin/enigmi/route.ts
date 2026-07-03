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

// GET /api/admin/enigmi?sessionId=<uuid|global>
// sessionId=global → restituisce enigmi globali (session_id IS NULL)
export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const admin = createAdminClient()
  let query = admin
    .from('enigmi')
    .select('*, frammenti:enigma_frammenti(*), suggerimenti:enigma_suggerimenti(*)')
    .order('created_at', { ascending: true })

  if (sessionId === 'global') {
    query = query.is('session_id', null)
  } else {
    query = query.eq('session_id', sessionId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort nested arrays by order_index (Supabase JS client doesn't support ordering nested selects)
  const enigmi = (data ?? []).map((e: any) => ({
    ...e,
    frammenti: (e.frammenti ?? []).sort((a: any, b: any) => a.order_index - b.order_index),
    suggerimenti: (e.suggerimenti ?? []).sort((a: any, b: any) => a.order_index - b.order_index),
  }))

  return NextResponse.json({ enigmi })
}

// POST /api/admin/enigmi
// body: { session_id, title, description, solution, difficulty, reward_type, reward_payload, frammenti[], suggerimenti[] }
export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const body = await request.json().catch(() => ({}))
  const { title, solution, difficulty } = body
  // session_id opzionale: null/assente = enigma globale (tutte le sessioni)
  const session_id: string | null = body.session_id || null

  if (!title || !solution || !difficulty) {
    return NextResponse.json({ error: 'Parametri mancanti: title, solution, difficulty sono obbligatori' }, { status: 400 })
  }

  const VALID_DIFFICULTIES = ['facile', 'medio', 'difficile']
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    return NextResponse.json({ error: 'difficulty non valida: usa facile, medio o difficile' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Insert the enigma
  const { data: enigma, error: enigmaError } = await admin
    .from('enigmi')
    .insert({
      session_id,
      title,
      description: body.description ?? null,
      solution,
      difficulty,
      reward_type: body.reward_type ?? null,
      reward_payload: body.reward_payload ?? null,
      lock_config: body.lock_config ?? null,
    })
    .select()
    .single()

  if (enigmaError) return NextResponse.json({ error: enigmaError.message }, { status: 500 })

  const enigmaId = enigma.id
  let frammenti: any[] = []
  let suggerimenti: any[] = []

  // Non-atomic: if frammenti/suggerimenti insert fails after enigma insert, a bare enigma row remains.
  // Admin-only context; acceptable risk until a stored procedure handles atomicity.
  // Insert frammenti if provided
  if (Array.isArray(body.frammenti) && body.frammenti.length > 0) {
    const rows = body.frammenti.map((f: any) => ({
      enigma_id: enigmaId,
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

  // Insert suggerimenti if provided
  if (Array.isArray(body.suggerimenti) && body.suggerimenti.length > 0) {
    const rows = body.suggerimenti.map((s: any) => ({
      enigma_id: enigmaId,
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

  return NextResponse.json({ enigma: { ...enigma, frammenti, suggerimenti } }, { status: 201 })
}
