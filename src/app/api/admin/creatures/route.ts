import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const VALID_RARITIES = ['comune', 'non_comune', 'raro', 'epico', 'leggendario'] as const
const VALID_ELEMENTS = ['fiamma', 'adriatico', 'bosco', 'terra', 'armonia'] as const

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin')
  if (rpcError) return { error: 'Errore verifica ruolo', status: 500 }
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

function validateInt(value: unknown, min = 1): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= min ? n : null
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
  const { name, description, rarity, element, hp, atk, def: defVal, evolution_of, session_id, catch_difficulty } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 })
  }
  if (!VALID_RARITIES.includes(rarity)) {
    return NextResponse.json({ error: `Rarità non valida. Valori consentiti: ${VALID_RARITIES.join(', ')}` }, { status: 400 })
  }
  if (!VALID_ELEMENTS.includes(element)) {
    return NextResponse.json({ error: `Elemento non valido. Valori consentiti: ${VALID_ELEMENTS.join(', ')}` }, { status: 400 })
  }

  const hpVal = hp !== undefined ? validateInt(hp) : 50
  const atkVal = atk !== undefined ? validateInt(atk) : 10
  const defParsed = defVal !== undefined ? validateInt(defVal, 0) : 5
  if (hpVal === null || atkVal === null || defParsed === null) {
    return NextResponse.json({ error: 'hp, atk e def devono essere numeri interi positivi' }, { status: 400 })
  }

  const admin = createAdminClient()
  const diffVal = catch_difficulty !== undefined ? validateInt(catch_difficulty, 1) : 1
  const { data, error } = await admin.from('creatures').insert({
    name: name.trim(),
    description: description ?? '',
    rarity,
    element,
    hp: hpVal,
    atk: atkVal,
    def: defParsed,
    evolution_of: evolution_of ?? null,
    session_id: session_id ?? null,
    catch_difficulty: diffVal ?? 1,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ creature: data }, { status: 201 })
}
