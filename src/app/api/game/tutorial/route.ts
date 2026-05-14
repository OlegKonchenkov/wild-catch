import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  TUTORIAL_SESSION_ID,
  TUTORIAL_USER_SESSION_TABLES,
  TUTORIAL_SUGGERIMENTO_ID,
} from '@/lib/game/tutorial'

/**
 * Tutorial session lifecycle.
 *
 * POST /api/game/tutorial — body `{ action: 'start' | 'reset' }`.
 *
 *  start
 *    Idempotently creates a player_session row for the caller inside the
 *    always-on tutorial session. Returns { sessionId } so the client can
 *    drop it into localStorage and navigate to /game/map like a normal
 *    join.
 *
 *  reset
 *    Wipes every per-(user, tutorial-session) row across the gameplay
 *    tables, then recreates a fresh player_session. The caller can replay
 *    the tutorial from scratch — useful for demoing the app to multiple
 *    prospects, or for users who want a do-over.
 *
 * Both actions verify the caller is authenticated. The tutorial session
 * itself is public, so no invite-code check.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { action?: string }
  const action = body.action ?? 'start'

  if (action !== 'start' && action !== 'reset') {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (action === 'reset') {
    // Order is not strictly important (FKs are user/session-scoped), but
    // we do it sequentially with await so a single failure surfaces.
    for (const table of TUTORIAL_USER_SESSION_TABLES) {
      const { error } = await admin
        .from(table)
        .delete()
        .eq('user_id', user.id)
        .eq('session_id', TUTORIAL_SESSION_ID)
      if (error) {
        return NextResponse.json({
          error: `Errore reset (${table})`,
          detail: error.message,
        }, { status: 500 })
      }
    }
    // Drop the player_session row itself so it can be recreated fresh.
    await admin
      .from('player_sessions')
      .delete()
      .eq('user_id', user.id)
      .eq('session_id', TUTORIAL_SESSION_ID)
  }

  // Re-create the player_session if it doesn't exist. Onboarding_seen
  // defaults to false (set by migration 029), so the carousel will fire
  // on first map entry — exactly what we want for a tutorial.
  const { data: existing } = await admin
    .from('player_sessions')
    .select('id, onboarding_seen')
    .eq('user_id', user.id)
    .eq('session_id', TUTORIAL_SESSION_ID)
    .maybeSingle()

  if (!existing) {
    const { error: insertErr } = await admin.from('player_sessions').insert({
      user_id: user.id,
      session_id: TUTORIAL_SESSION_ID,
      role: 'player',
    })
    if (insertErr) {
      return NextResponse.json({
        error: 'Errore creazione tutorial',
        detail: insertErr.message,
      }, { status: 500 })
    }
  }

  // Pre-grant the free enigma hint. In a real event a player would find a
  // suggerimento on a map pin or by scanning a QR — the tutorial hands it
  // to them up front so they learn the mechanic before having to hunt.
  // Idempotent: UNIQUE(user_id, session_id, suggerimento_id) handles dupes.
  await admin
    .from('player_enigma_suggerimenti')
    .upsert(
      {
        user_id: user.id,
        session_id: TUTORIAL_SESSION_ID,
        suggerimento_id: TUTORIAL_SUGGERIMENTO_ID,
      },
      { onConflict: 'user_id,session_id,suggerimento_id', ignoreDuplicates: true },
    )

  return NextResponse.json({
    sessionId: TUTORIAL_SESSION_ID,
    action,
  })
}
