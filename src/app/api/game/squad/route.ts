import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const { data } = await supabase
    .from('player_sessions')
    .select('squad_ids')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  // Squad changes only on explicit PATCH from this same user — 15s of
  // freshness is safe and removes most of the repeat traffic from the
  // map/battle screen re-fetching on mount.
  return NextResponse.json({ squadIds: data?.squad_ids ?? [] }, {
    headers: {
      'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
    },
  })
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, squadIds } = await request.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })
  if (!Array.isArray(squadIds) || squadIds.length > 3) {
    return NextResponse.json({ error: 'Squadra non valida (max 3)' }, { status: 400 })
  }

  // Validate all IDs belong to this user in this session
  if (squadIds.length > 0) {
    const { data: pcs } = await supabase
      .from('player_creatures')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .in('id', squadIds)

    if (!pcs || pcs.length !== squadIds.length) {
      return NextResponse.json({ error: 'Creature non valide per questa sessione' }, { status: 400 })
    }
  }

  const update: Record<string, unknown> = { squad_ids: squadIds }
  // Sync selected_creature_id to squad slot 0 (primary fighter)
  if (squadIds.length > 0) {
    update.selected_creature_id = squadIds[0]
  }

  await supabase
    .from('player_sessions')
    .update(update)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)

  return NextResponse.json({ ok: true, squadIds })
}
