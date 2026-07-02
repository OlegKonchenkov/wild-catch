import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Generic admin CRUD for the loot/collection catalogue tables. A strict
 * allowlist maps each table to the columns an admin may write, so this one
 * route safely backs every authoring screen without per-table boilerplate.
 */
const TABLES: Record<string, { cols: string[]; order?: string }> = {
  packs:           { cols: ['name', 'description', 'rarity', 'image_url', 'min_drops', 'max_drops', 'price_gold', 'price_gemme'], order: 'created_at' },
  pack_pool:       { cols: ['pack_id', 'reward_type', 'reward_payload', 'weight', 'rarity_tier', 'min_qty', 'max_qty'], order: 'created_at' },
  chests:          { cols: ['name', 'description', 'rarity', 'image_url', 'place_id', 'key_requirements', 'contents'], order: 'created_at' },
  special_prizes:  { cols: ['name', 'description', 'rarity', 'image_url', 'redemption_note'], order: 'created_at' },
  cultural_places: { cols: ['name', 'description', 'image_url', 'lat', 'lng', 'session_id'], order: 'created_at' },
  artworks:        { cols: ['name', 'description', 'image_url', 'place_id', 'rarity'], order: 'created_at' },
  characters:      { cols: ['name', 'description', 'image_url', 'place_id', 'rarity', 'unlocks_ability_id'], order: 'created_at' },
  anecdotes:       { cols: ['title', 'body', 'image_url', 'place_id', 'character_id', 'rarity'], order: 'created_at' },
  trophies:        { cols: ['name', 'description', 'image_url', 'criteria'], order: 'created_at' },
  quizzes:         { cols: ['question', 'options', 'correct_index', 'place_id', 'unlock_anecdote_id', 'reward', 'session_id'], order: 'created_at' },
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

function pick(body: Record<string, unknown>, cols: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const c of cols) if (c in body) out[c] = body[c] === '' ? null : body[c]
  return out
}

async function guard(table: string) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return { error: NextResponse.json({ error: auth.error }, { status: (auth as any).status }) }
  const spec = TABLES[table]
  if (!spec) return { error: NextResponse.json({ error: 'Tabella non gestita' }, { status: 404 }) }
  // Dynamic table name — cast past the client's literal-table typing (safe: strict allowlist above).
  return { admin: createAdminClient() as any, spec }
}

export async function GET(_req: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  const g = await guard(table)
  if ('error' in g) return g.error
  const q = g.admin.from(table).select('*')
  const { data, error } = g.spec.order ? await q.order(g.spec.order, { ascending: true }) : await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  const g = await guard(table)
  if ('error' in g) return g.error
  const body = await req.json().catch(() => ({}))
  const { data, error } = await g.admin.from(table).insert(pick(body, g.spec.cols)).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  const g = await guard(table)
  if ('error' in g) return g.error
  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })
  const { data, error } = await g.admin.from(table).update(pick(body, g.spec.cols)).eq('id', body.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  const g = await guard(table)
  if ('error' in g) return g.error
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })
  const { error } = await g.admin.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
