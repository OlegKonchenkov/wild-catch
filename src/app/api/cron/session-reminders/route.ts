import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToSession } from '@/lib/push'

// Thresholds (minutes before end) at which we send a reminder push.
// Kept short on purpose so notifications don't feel spammy.
const THRESHOLDS = [30, 10, 1] as const
// Sentinel value stored in push_reminders_sent once the "session ended" push
// has been sent. Picked outside the THRESHOLDS range.
const ENDED_MARK = 0

interface SessionRow {
  id: string
  end_at: string | null
  status: string
  push_reminders_sent: number[] | null
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  // Supabase pg_cron (migration 043) attaches `Authorization: Bearer
  // ${CRON_SECRET}` via pg_net. Same header works for manual local calls.
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const horizonAhead = new Date(now.getTime() + 32 * 60 * 1000).toISOString()
  const recentPast = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

  // 1. Active sessions ending within the next 32 minutes → fire 30/10/1 reminders
  const { data: ending } = await admin
    .from('sessions')
    .select('id, end_at, status, push_reminders_sent')
    .eq('status', 'active')
    .not('end_at', 'is', null)
    .gt('end_at', now.toISOString())
    .lt('end_at', horizonAhead)

  // 2. Sessions just ended (e.g. via pg_cron auto-close) that haven't been
  //    notified yet → fire one "ended" push (deduped by ENDED_MARK).
  const { data: justEnded } = await admin
    .from('sessions')
    .select('id, end_at, status, push_reminders_sent')
    .eq('status', 'ended')
    .gt('end_at', recentPast)
    .lt('end_at', now.toISOString())

  const remindersSent: Array<{ sessionId: string; mark: number }> = []
  const endedSent: string[] = []

  for (const s of (ending ?? []) as SessionRow[]) {
    const endMs = new Date(s.end_at!).getTime()
    const minutesLeft = Math.max(1, Math.ceil((endMs - now.getTime()) / 60000))
    const already = new Set(s.push_reminders_sent ?? [])

    for (const t of THRESHOLDS) {
      if (minutesLeft <= t && !already.has(t)) {
        const body =
          t === 1  ? '⏳ Ultimo minuto! Sbrigati con la cattura finale.'
          : t === 10 ? '⏰ Restano 10 minuti — pianifica l\'ultimo giro.'
          :            '⏰ Mancano 30 minuti alla fine della sessione.'
        void sendPushToSession(s.id, {
          title: `⏰ ${t} ${t === 1 ? 'minuto' : 'minuti'} alla fine`,
          body,
          url: '/game/map',
          tag: `session_${s.id}_t${t}`,
        })
        // Atomic-ish: append the threshold + read back. With concurrent cron
        // overlap this could double-send for one tick (acceptable: same tag).
        const next = Array.from(new Set([...(s.push_reminders_sent ?? []), t]))
        await admin.from('sessions').update({ push_reminders_sent: next }).eq('id', s.id)
        already.add(t)
        remindersSent.push({ sessionId: s.id, mark: t })
      }
    }
  }

  for (const s of (justEnded ?? []) as SessionRow[]) {
    const already = new Set(s.push_reminders_sent ?? [])
    if (already.has(ENDED_MARK)) continue
    void sendPushToSession(s.id, {
      title: '🏁 Sessione terminata',
      body: 'L\'evento è concluso. Controlla classifica e DaimonDex!',
      url: '/home',
      tag: `session_${s.id}_end`,
    })
    const next = Array.from(new Set([...(s.push_reminders_sent ?? []), ENDED_MARK]))
    await admin.from('sessions').update({ push_reminders_sent: next }).eq('id', s.id)
    endedSent.push(s.id)
  }

  return NextResponse.json({
    ok: true,
    checkedAt: now.toISOString(),
    reminders: remindersSent,
    ended: endedSent,
  })
}
