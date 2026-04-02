import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/game/map-pins?sessionId=...
// Returns map pins for the given session (visible to all authenticated players)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const { data, error } = await supabase
    .from('session_map_pins')
    .select('id, lat, lng, name, description')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pins: data ?? [] })
}
