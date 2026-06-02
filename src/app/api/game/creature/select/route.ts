import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

export async function PUT(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { playerCreatureId, sessionId } = await request.json()

  // Verify player owns this creature
  const { data: pc } = await supabase
    .from('player_creatures')
    .select('id')
    .eq('id', playerCreatureId)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!pc) return NextResponse.json({ error: 'Creatura non trovata' }, { status: 404 })

  await supabase
    .from('player_sessions')
    .update({ selected_creature_id: playerCreatureId })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)

  return NextResponse.json({ success: true })
}
