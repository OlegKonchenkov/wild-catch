import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, creatureId } = await request.json()
  if (!sessionId || !creatureId) return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })

  // Verify session is active
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single()

  if (!session || session.status === 'ended') {
    return NextResponse.json({ error: 'Sessione non valida' }, { status: 400 })
  }

  // Double-check: player must still have 0 creatures (race condition guard)
  const { count } = await supabase
    .from('player_creatures')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Hai già una creatura' }, { status: 409 })
  }

  // Verify the creature is a valid comune starter
  const { data: creature } = await supabase
    .from('creatures')
    .select('id, name, rarity, element, image_url, sprite_url, hp, atk, def, description')
    .eq('id', creatureId)
    .eq('rarity', 'comune')
    .eq('spawnable', true)
    .single()

  if (!creature) return NextResponse.json({ error: 'Creatura non valida' }, { status: 400 })

  const admin = createAdminClient()

  await admin.from('player_creatures').insert({
    user_id: user.id,
    creature_id: creature.id,
    session_id: sessionId,
    duplicates_count: 1,
  })

  // Save a game event for bell history
  admin.from('player_game_events').insert({
    user_id: user.id,
    session_id: sessionId,
    type: 'catch',
    payload: {
      creature_name: creature.name,
      rarity: creature.rarity,
      element: creature.element,
      evolved: false,
      starter: true,
    },
  }).then(undefined, () => {})

  return NextResponse.json({ success: true, creature })
}
