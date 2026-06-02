import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

/**
 * POST /api/game/onboarding
 *
 * Marks the per-session onboarding carousel as seen for the current user.
 * Idempotent: calling it again is a no-op.
 *
 * Body: { sessionId: string, seen?: boolean }
 *   seen=true  (default) → finishes / skips the tutorial.
 *   seen=false           → re-arms the flag so the user sees it again.
 *                          Used by the "Rivedi tutorial" button in /game/guide.
 *
 * Returns: { onboardingSeen: boolean }
 */
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { sessionId?: string; seen?: boolean }
  const { sessionId, seen = true } = body
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })
  }

  // The update target is enforced by RLS (player_sessions.user_id = auth.uid()).
  // No extra check needed — at worst it touches 0 rows for an invalid sessionId.
  const { data, error } = await supabase
    .from('player_sessions')
    .update({ onboarding_seen: seen })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .select('onboarding_seen')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Errore di aggiornamento' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  }

  return NextResponse.json({ onboardingSeen: data.onboarding_seen })
}
