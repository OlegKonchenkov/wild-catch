import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { sessionId, name, narrativeConfig, areaBounds, durationMinutes, starterKit } = body

  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (name             !== undefined) updates.name             = name
  if (narrativeConfig  !== undefined) updates.narrative_config = narrativeConfig
  if (areaBounds       !== undefined) updates.area_bounds      = areaBounds
  if (durationMinutes  !== undefined) updates.duration_minutes = durationMinutes
  if (starterKit       !== undefined) updates.starter_kit      = starterKit

  // BUG-01: se la sessione è attiva e si aggiorna duration_minutes,
  // ricalcola end_at da start_at + nuova durata e lo persiste
  let newEndAt: string | null = null
  if (durationMinutes !== undefined) {
    const { data: sess } = await supabase
      .from('sessions')
      .select('status, start_at')
      .eq('id', sessionId)
      .single()
    if (sess?.status === 'active' && sess.start_at) {
      newEndAt = new Date(
        new Date(sess.start_at).getTime() + durationMinutes * 60 * 1000
      ).toISOString()
      updates.end_at = newEndAt
    }
  }

  const { error } = await supabase.from('sessions').update(updates).eq('id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Broadcast end_at aggiornato a tutti i player connessi
  if (newEndAt) {
    const channel = supabase.channel(`session:${sessionId}`)
    await new Promise<void>(resolve => channel.subscribe(() => resolve()))
    await channel.send({
      type: 'broadcast',
      event: 'session_duration_updated',
      payload: { sessionId, endAt: newEndAt },
    })
    await supabase.removeChannel(channel)
  }

  return NextResponse.json({ updated: true, endAt: newEndAt })
}
