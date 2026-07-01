import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/types/database'

const ELEMENTS = ['fiamma', 'adriatico', 'bosco', 'terra', 'armonia'] as const
const RARITIES = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico'] as const
const CATEGORIES = ['attacco', 'stato', 'cura', 'potenziamento', 'difesa'] as const
const TARGETS = ['enemy', 'self'] as const
const STATUSES = ['paralisi', 'confusione', 'sonno', 'veleno', 'scottatura', 'congelamento', 'rigenerazione', 'marchio'] as const

function oneOf<T extends readonly string[]>(list: T, v: unknown): v is T[number] {
  return typeof v === 'string' && (list as readonly string[]).includes(v)
}
function nullableEnum<T extends readonly string[]>(list: T, v: unknown): string | null {
  return oneOf(list, v) ? v : null
}
function num(v: unknown, def = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Validate + normalize an ability body into a DB row payload, or return an error string. */
function sanitizeAbility(body: Record<string, unknown>): { data: Record<string, unknown> } | { error: string } {
  const name = String(body.name ?? '').trim()
  if (!name) return { error: 'Nome obbligatorio' }
  if (body.category !== undefined && !oneOf(CATEGORIES, body.category)) return { error: 'Categoria non valida' }
  if (body.target !== undefined && !oneOf(TARGETS, body.target)) return { error: 'Bersaglio non valido' }

  const hitsMin = Math.max(1, Math.round(num(body.hits_min, 1)))
  const hitsMax = Math.max(hitsMin, Math.round(num(body.hits_max, hitsMin)))

  let allowedElements: string[] | null = null
  if (Array.isArray(body.allowed_elements)) {
    const filtered = body.allowed_elements.filter(e => oneOf(ELEMENTS, e))
    allowedElements = filtered.length > 0 ? (filtered as string[]) : null
  }

  return {
    data: {
      name,
      description: String(body.description ?? '').trim(),
      element: nullableEnum(ELEMENTS, body.element),
      category: oneOf(CATEGORIES, body.category) ? body.category : 'attacco',
      rarity: nullableEnum(RARITIES, body.rarity),
      power: Math.max(0, num(body.power, 0)),
      accuracy: clamp(num(body.accuracy, 1), 0, 1),
      target: oneOf(TARGETS, body.target) ? body.target : 'enemy',
      priority: Math.round(num(body.priority, 0)),
      charge_turns: Math.max(0, Math.round(num(body.charge_turns, 0))),
      recharge_turns: Math.max(0, Math.round(num(body.recharge_turns, 0))),
      cooldown: Math.max(0, Math.round(num(body.cooldown, 0))),
      max_uses: body.max_uses == null || body.max_uses === '' ? null : Math.max(1, Math.round(num(body.max_uses, 1))),
      hits_min: hitsMin,
      hits_max: hitsMax,
      status_effect: nullableEnum(STATUSES, body.status_effect),
      status_chance: clamp(num(body.status_chance, 0), 0, 1),
      self_status: nullableEnum(STATUSES, body.self_status),
      heal_percent: clamp(num(body.heal_percent, 0), 0, 1),
      lifesteal_percent: clamp(num(body.lifesteal_percent, 0), 0, 1),
      buff_atk: num(body.buff_atk, 0),
      buff_def: num(body.buff_def, 0),
      debuff_atk: num(body.debuff_atk, 0),
      debuff_def: num(body.debuff_def, 0),
      min_level: Math.max(1, Math.round(num(body.min_level, 1))),
      min_rarity: nullableEnum(RARITIES, body.min_rarity),
      allowed_elements: allowedElements,
      icon_url: body.icon_url ? String(body.icon_url) : null,
      animation_key: String(body.animation_key ?? 'basic_strike').trim() || 'basic_strike',
      sound_url: body.sound_url ? String(body.sound_url) : null,
      color: body.color ? String(body.color) : null,
    },
  }
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

// GET /api/admin/abilities
export async function GET() {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as { status: number }).status })

  const admin = createAdminClient()
  const { data, error } = await admin.from('abilities').select('*').order('element').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ abilities: data ?? [] })
}

// POST /api/admin/abilities — create
export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as { status: number }).status })

  const body = await request.json().catch(() => ({}))
  const sanitized = sanitizeAbility(body)
  if ('error' in sanitized) return NextResponse.json({ error: sanitized.error }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('abilities').insert(sanitized.data as TablesInsert<'abilities'>).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ability: data })
}

// PUT /api/admin/abilities — update
export async function PUT(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as { status: number }).status })

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })
  const sanitized = sanitizeAbility(body)
  if ('error' in sanitized) return NextResponse.json({ error: sanitized.error }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('abilities').update(sanitized.data).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ability: data })
}

// DELETE /api/admin/abilities
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as { status: number }).status })

  const { id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('abilities').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
