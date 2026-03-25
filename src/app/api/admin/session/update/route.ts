import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { sessionId, name, narrativeConfig, areaBounds, durationMinutes } = body

  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (name             !== undefined) updates.name             = name
  if (narrativeConfig  !== undefined) updates.narrative_config = narrativeConfig
  if (areaBounds       !== undefined) updates.area_bounds      = areaBounds
  if (durationMinutes  !== undefined) updates.duration_minutes = durationMinutes

  const { error } = await supabase.from('sessions').update(updates).eq('id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ updated: true })
}
