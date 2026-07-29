import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { FLEE_COOLDOWN_SECONDS } from '@/lib/game/step-counter'

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('encounter_act', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const body = await request.json().catch(() => ({}))
  const { encounterId } = body
  if (!encounterId) return NextResponse.json({ error: 'encounterId mancante' }, { status: 400 })

  // Close the encounter and read back its session in one round trip — we need
  // the session id to apply the cooldown, and `.select()` gives it to us only
  // for a row that was actually still active and owned by this user.
  const { data: fled } = await supabase
    .from('encounters')
    .update({ status: 'fled', resolved_at: new Date().toISOString() })
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .select('session_id')
    .maybeSingle()

  // Fleeing costs a short encounter blackout. Without it, bailing out was a
  // free reroll: creature HP resets every encounter, so there was no reason
  // NOT to run from anything you didn't want and immediately spin again.
  // Skipped when nothing was actually closed (double-tap, already resolved) so
  // a no-op request can't extend the player's own cooldown.
  let blockedUntil: string | null = null
  if (fled?.session_id) {
    blockedUntil = new Date(Date.now() + FLEE_COOLDOWN_SECONDS * 1000).toISOString()
    await supabase
      .from('player_sessions')
      .update({ encounter_block_until: blockedUntil })
      .eq('user_id', user.id)
      .eq('session_id', fled.session_id)
  }

  return NextResponse.json({
    ok: true,
    blockedUntil,
    cooldownSeconds: blockedUntil ? FLEE_COOLDOWN_SECONDS : 0,
  })
}
