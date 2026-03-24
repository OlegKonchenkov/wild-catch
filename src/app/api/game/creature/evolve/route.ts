import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { playerCreatureId, sessionId } = await request.json()

  // Get player creature
  const { data: pc } = await supabase
    .from('player_creatures')
    .select('*, creatures(*)')
    .eq('id', playerCreatureId)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!pc) return NextResponse.json({ error: 'Creatura non trovata' }, { status: 404 })
  if (pc.evolved) return NextResponse.json({ error: 'Già evoluta' }, { status: 400 })
  if (pc.duplicates_count < 3) {
    return NextResponse.json({
      error: `Servono 3 duplicati (hai ${pc.duplicates_count})`
    }, { status: 400 })
  }

  const baseCreatureId = (pc as any).creatures?.id
  const { data: evolvedForm } = await supabase
    .from('creatures')
    .select('*')
    .eq('evolution_of', baseCreatureId)
    .single()

  if (!evolvedForm) return NextResponse.json({ error: 'Nessuna forma evoluta disponibile' }, { status: 404 })

  await supabase
    .from('player_creatures')
    .update({ evolved: true, creature_id: evolvedForm.id })
    .eq('id', playerCreatureId)

  return NextResponse.json({
    evolved: true,
    newCreature: {
      id: evolvedForm.id,
      name: evolvedForm.name,
      element: evolvedForm.element,
      image_url: evolvedForm.image_url,
    },
  })
}
