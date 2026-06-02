import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, creatureId } = await request.json()
  if (!sessionId || !creatureId) return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })

  // Starter choice is only valid once the player can actually enter gameplay.
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single()

  if (!session || !['ready', 'active'].includes(session.status)) {
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
    .select('id, name, rarity, element, image_url, sprite_cutout_url, sprite_url, hp, atk, def, description')
    .eq('id', creatureId)
    .eq('rarity', 'comune')
    .eq('spawnable', true)
    .single()

  if (!creature) return NextResponse.json({ error: 'Creatura non valida' }, { status: 400 })

  const admin = createAdminClient()

  const { data: pc } = await admin.from('player_creatures').insert({
    user_id: user.id,
    creature_id: creature.id,
    session_id: sessionId,
    duplicates_count: 1,
  }).select('id').single()

  // Atomically claim the starter slot. Without `.is('selected_creature_id',
  // null)` two concurrent calls (different creature_ids → no UNIQUE
  // collision on player_creatures) could both pass the count==0 check
  // and both insert a creature. The guard ensures only the first
  // request actually becomes the starter; the loser rolls back its
  // creature insert below.
  if (pc?.id) {
    const { data: claimedRows } = await admin.from('player_sessions')
      .update({ squad_ids: [pc.id], selected_creature_id: pc.id })
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .is('selected_creature_id', null)
      .select('id')

    if (!claimedRows || claimedRows.length === 0) {
      // Lost the race: another request became the starter. Roll back our
      // creature insert so the player doesn't end up with two starters.
      await admin.from('player_creatures').delete().eq('id', pc.id)
      return NextResponse.json({ error: 'Starter già scelto', alreadyPicked: true }, { status: 409 })
    }
  }

  // Save a game event for bell history
  admin.from('player_game_events').insert({
    user_id: user.id,
    session_id: sessionId,
    type: 'catch',
    payload: {
      creature_name: creature.name,
      rarity:        creature.rarity,
      element:       creature.element,
      evolved:       false,
      starter:       true,
      image_url:     (creature as any).sprite_cutout_url || (creature as any).sprite_url || (creature as any).image_url || null,
      hp:  (creature as any).hp  ?? null,
      atk: (creature as any).atk ?? null,
      def: (creature as any).def ?? null,
    },
  }).then(undefined, () => {})

  return NextResponse.json({ success: true, creature })
}
