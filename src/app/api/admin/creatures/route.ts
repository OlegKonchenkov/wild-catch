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

export async function GET() {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()
  const { data, error } = await admin.from('creatures').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ creatures: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { name, description, rarity, element, base_hp, base_attack, base_defense, evolution_of } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 })
  }
  if (!VALID_RARITIES.includes(rarity)) {
    return NextResponse.json({ error: `Rarità non valida. Valori consentiti: ${VALID_RARITIES.join(', ')}` }, { status: 400 })
  }
  if (element !== undefined && !VALID_ELEMENTS.includes(element)) {
    return NextResponse.json({ error: `Elemento non valido. Valori consentiti: ${VALID_ELEMENTS.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('creatures').insert({
    name: name.trim(),
    description: description ?? null,
    rarity,
    element: element ?? 'neutro',
    base_hp: base_hp ?? 50,
    base_attack: base_attack ?? 10,
    base_defense: base_defense ?? 5,
    evolution_of: evolution_of ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ creature: data }, { status: 201 })
}
