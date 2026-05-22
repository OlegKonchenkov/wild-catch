import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  // Only sessions that are about to start or currently active can offer a starter.
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  if (!['ready', 'active'].includes(session.status)) {
    return NextResponse.json({
      alreadyHasCreatures: true,
      starters: [],
      starterAvailable: false,
      sessionStatus: session.status,
    })
  }

  // Check player already has creatures in this session
  const { count } = await supabase
    .from('player_creatures')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)

  if ((count ?? 0) > 0) {
    return NextResponse.json({
      alreadyHasCreatures: true,
      starters: [],
      starterAvailable: false,
      sessionStatus: session.status,
    })
  }

  // Return all comune spawnable creatures
  const { data: creatures } = await supabase
    .from('creatures')
    .select('id, name, rarity, element, image_url, sprite_cutout_url, sprite_url, hp, atk, def, description')
    .eq('rarity', 'comune')
    .eq('spawnable', true)
    .order('name')

  return NextResponse.json({
    alreadyHasCreatures: false,
    starters: creatures ?? [],
    starterAvailable: true,
    sessionStatus: session.status,
  })
}
