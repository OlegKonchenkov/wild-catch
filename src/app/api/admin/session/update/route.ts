import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToSession } from '@/lib/push'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { sessionId, name, narrativeConfig, areaBounds, durationMinutes, starterKit, dailyRewardsEnabled, dailyPackId, endAt } = body

  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (name             !== undefined) updates.name             = name
  if (narrativeConfig  !== undefined) updates.narrative_config = narrativeConfig
  if (areaBounds       !== undefined) updates.area_bounds      = areaBounds
  if (durationMinutes  !== undefined) updates.duration_minutes = durationMinutes
  if (starterKit       !== undefined) updates.starter_kit      = starterKit
  if (dailyRewardsEnabled !== undefined) updates.daily_rewards_enabled = !!dailyRewardsEnabled
  if (dailyPackId      !== undefined) updates.daily_pack_id    = dailyPackId || null
  // Avventura: optional explicit deadline (null clears it → runs forever).
  // kind is intentionally NOT updatable after creation.
  if (endAt !== undefined) {
    updates.end_at   = endAt || null
    updates.auto_end = !!endAt
  }

  // BUG-01: se la sessione è attiva e si aggiorna duration_minutes,
  // ricalcola end_at da start_at + nuova durata e lo persiste.
  // Solo per sessioni 'event': per le avventure la durata è ignorata.
  let newEndAt: string | null = null
  if (durationMinutes !== undefined) {
    const { data: sess } = await supabase
      .from('sessions')
      .select('status, start_at, kind')
      .eq('id', sessionId)
      .single()
    if ((sess as { kind?: string } | null)?.kind === 'avventura') {
      // no countdown recompute for avventure
    } else if (sess?.status === 'active' && sess.start_at) {
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

    // Push + reset reminder marks (la nuova end_at potrebbe sbloccare
    // soglie 30/10/1 min già state notificate sulla scadenza precedente).
    const endHHMM = new Date(newEndAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    after(() => sendPushToSession(sessionId, {
      title: '⏰ Durata sessione aggiornata',
      body: `La sessione ora termina alle ${endHHMM}.`,
      url: '/game/map',
      tag: `session_${sessionId}_duration`,
    }))
    await supabase.from('sessions').update({ push_reminders_sent: [] }).eq('id', sessionId).then(undefined, () => {})
  }

  return NextResponse.json({ updated: true, endAt: newEndAt })
}
