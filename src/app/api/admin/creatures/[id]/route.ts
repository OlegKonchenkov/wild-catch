import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const VALID_RARITIES = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico'] as const
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await request.json()
  const { name, description, rarity, element, hp, atk, def: defVal, evolution_of, session_id, catch_difficulty,
    enigma_title, enigma_description, enigma_image_url, enigma_video_url, enigma_frammento_id, spawnable,
    attack_sound_url, attack_sound_duration_ms,
    status_effect, status_effect_chance } = body

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
  if (hp !== undefined) {
    const v = validateInt(hp); if (v === null) return NextResponse.json({ error: 'hp deve essere un intero positivo' }, { status: 400 }); updates.hp = v
  }
  if (atk !== undefined) {
    const v = validateInt(atk); if (v === null) return NextResponse.json({ error: 'atk deve essere un intero positivo' }, { status: 400 }); updates.atk = v
  }
  if (defVal !== undefined) {
    const v = validateInt(defVal, 0); if (v === null) return NextResponse.json({ error: 'def deve essere un intero >= 0' }, { status: 400 }); updates.def = v
  }
  if (evolution_of !== undefined) updates.evolution_of = evolution_of
  if (session_id !== undefined) updates.session_id = session_id ?? null
  if (catch_difficulty !== undefined) {
    const v = validateInt(catch_difficulty, 1)
    if (v !== null && v <= 5) updates.catch_difficulty = v
  }
  if (enigma_title !== undefined) updates.enigma_title = enigma_title || null
  if (enigma_description !== undefined) updates.enigma_description = enigma_description || null
  if (enigma_image_url !== undefined) updates.enigma_image_url = enigma_image_url || null
  if (enigma_video_url !== undefined) updates.enigma_video_url = enigma_video_url || null
  if (enigma_frammento_id !== undefined) updates.enigma_frammento_id = enigma_frammento_id ?? null
  if (spawnable !== undefined) updates.spawnable = Boolean(spawnable)
  if (attack_sound_url !== undefined) updates.attack_sound_url = attack_sound_url || null
  if (attack_sound_duration_ms !== undefined) updates.attack_sound_duration_ms = attack_sound_duration_ms ? Number(attack_sound_duration_ms) : null
  const VALID_STATUS_EFFECTS = ['paralisi', 'confusione', 'sonno', 'veleno']
  if (status_effect !== undefined) updates.status_effect = status_effect && VALID_STATUS_EFFECTS.includes(status_effect) ? status_effect : null
  if (status_effect_chance !== undefined) {
    const v = Number(status_effect_chance)
    if (Number.isFinite(v) && v >= 0 && v <= 1) updates.status_effect_chance = v
  }

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
