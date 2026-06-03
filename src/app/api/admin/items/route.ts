import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/types/database'

const EQUIP_TYPES = ['arma', 'corazza', 'elmo', 'accessorio'] as const
const VALID_TYPES = ['rete', 'esca', 'uovo', 'battaglia', 'pozione', 'cura', 'custom', ...EQUIP_TYPES] as const
const VALID_RARITIES = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico'] as const

function isEquip(type: string): boolean {
  return (EQUIP_TYPES as readonly string[]).includes(type)
}

function equipFields(type: string, body: Record<string, unknown>): Record<string, unknown> {
  if (!isEquip(type)) {
    return { bonus_hp: 0, bonus_atk: 0, bonus_def: 0, rarity: null }
  }
  const rarityRaw = String(body.rarity ?? '')
  const rarity = (VALID_RARITIES as readonly string[]).includes(rarityRaw) ? rarityRaw : 'comune'
  return {
    bonus_hp: Math.max(0, Math.round(Number(body.bonus_hp) || 0)),
    bonus_atk: Math.max(0, Math.round(Number(body.bonus_atk) || 0)),
    bonus_def: Math.max(0, Math.round(Number(body.bonus_def) || 0)),
    rarity,
  }
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

// GET /api/admin/items
export async function GET() {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const admin = createAdminClient()
  const { data, error } = await admin.from('items').select('*').order('type').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/admin/items — create
export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const body = await request.json().catch(() => ({}))
  const { name, type, effect_value, description, shop_price, session_id, image_url, egg_rarity, steps_required, is_redeemable, reward, in_shop } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })

  const admin = createAdminClient()
  const insertData: Record<string, unknown> = {
    name: name.trim(),
    type,
    effect_value: type === 'custom' ? 0 : (Number(effect_value) || 0),
    description: description?.trim() ?? '',
    shop_price: type === 'custom' ? (in_shop ? Number(shop_price) || 0 : 0) : (Number(shop_price) || 0),
    session_id: session_id ?? null,
    image_url: image_url ?? null,
    is_redeemable: type === 'custom' ? true : (is_redeemable ?? false),
    reward: reward ?? {},
    in_shop: type === 'custom' ? (in_shop ?? true) : true,
    ...equipFields(type, body),
  }
  if (type === 'uovo') {
    insertData.egg_rarity = egg_rarity ?? 'comune'
    insertData.steps_required = Number(steps_required) || 0
  }
  const { data, error } = await admin.from('items').insert(insertData as TablesInsert<'items'>).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// PUT /api/admin/items — update
export async function PUT(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const body = await request.json().catch(() => ({}))
  const { id, name, type, effect_value, description, shop_price, session_id, image_url, egg_rarity, steps_required, is_redeemable, reward, in_shop } = body

  if (!id) return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })

  const admin = createAdminClient()
  const updateData: Record<string, unknown> = {
    name: name.trim(),
    type,
    effect_value: type === 'custom' ? 0 : (Number(effect_value) || 0),
    description: description?.trim() ?? '',
    shop_price: type === 'custom' ? (in_shop ? Number(shop_price) || 0 : 0) : (Number(shop_price) || 0),
    session_id: session_id !== undefined ? (session_id ?? null) : undefined,
    image_url: image_url !== undefined ? (image_url ?? null) : undefined,
    is_redeemable: type === 'custom' ? true : (is_redeemable ?? false),
    reward: reward ?? {},
    in_shop: type === 'custom' ? (in_shop ?? true) : true,
    ...equipFields(type, body),
  }
  if (type === 'uovo') {
    updateData.egg_rarity = egg_rarity ?? 'comune'
    updateData.steps_required = Number(steps_required) || 0
  }
  const { data, error } = await admin.from('items').update(updateData).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// DELETE /api/admin/items
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
