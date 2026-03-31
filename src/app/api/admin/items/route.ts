import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const VALID_TYPES = ['rete', 'esca', 'uovo', 'battaglia', 'pozione', 'cura'] as const

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
  const { name, type, effect_value, description, shop_price, session_id, image_url, egg_rarity, steps_required, is_redeemable, reward } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })

  const admin = createAdminClient()
  const insertData: Record<string, unknown> = {
    name: name.trim(),
    type,
    effect_value: Number(effect_value) || 0,
    description: description?.trim() ?? '',
    shop_price: Number(shop_price) || 0,
    session_id: session_id ?? null,
    image_url: image_url ?? null,
    is_redeemable: is_redeemable ?? false,
    reward: reward ?? {},
  }
  if (type === 'uovo') {
    insertData.egg_rarity = egg_rarity ?? 'comune'
    insertData.steps_required = Number(steps_required) || 0
  }
  const { data, error } = await admin.from('items').insert(insertData).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// PUT /api/admin/items — update
export async function PUT(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const body = await request.json().catch(() => ({}))
  const { id, name, type, effect_value, description, shop_price, session_id, image_url, egg_rarity, steps_required, is_redeemable, reward } = body

  if (!id) return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })

  const admin = createAdminClient()
  const updateData: Record<string, unknown> = {
    name: name.trim(),
    type,
    effect_value: Number(effect_value) || 0,
    description: description?.trim() ?? '',
    shop_price: Number(shop_price) || 0,
    session_id: session_id !== undefined ? (session_id ?? null) : undefined,
    image_url: image_url !== undefined ? (image_url ?? null) : undefined,
    is_redeemable: is_redeemable ?? false,
    reward: reward ?? {},
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
