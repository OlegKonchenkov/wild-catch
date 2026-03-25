import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const VALID_RARITIES = ['comune', 'non_comune', 'raro', 'epico', 'leggendario'] as const
const VALID_ELEMENTS = ['acqua', 'terra', 'aria', 'fuoco', 'elettro', 'natura', 'neutro'] as const

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await request.json()
  const { name, description, rarity, element, base_hp, base_attack, base_defense, evolution_of } = body

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return NextResponse.json({ error: 'Il nome non può essere vuoto' }, { status: 400 })
  }
  if (rarity !== undefined && !VALID_RARITIES.includes(rarity)) {
    return NextResponse.json({ error: `Rarità non valida. Valori consentiti: ${VALID_RARITIES.join(', ')}` }, { status: 400 })
  }
  if (element !== undefined && !VALID_ELEMENTS.includes(element)) {
    return NextResponse.json({ error: `Elemento non valido. Valori consentiti: ${VALID_ELEMENTS.join(', ')}` }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name.trim()
  if (description !== undefined) updates.description = description
  if (rarity !== undefined) updates.rarity = rarity
  if (element !== undefined) updates.element = element
  if (base_hp !== undefined) updates.base_hp = base_hp
  if (base_attack !== undefined) updates.base_attack = base_attack
  if (base_defense !== undefined) updates.base_defense = base_defense
  if (evolution_of !== undefined) updates.evolution_of = evolution_of

  const admin = createAdminClient()
  const { data, error } = await admin.from('creatures').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ creature: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params

  const admin = createAdminClient()
  const { error } = await admin.from('creatures').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
