import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import {
  TUTORIAL_SESSION_ID,
  TUTORIAL_BONUS_SUGGERIMENTO_ID,
} from '@/lib/game/tutorial'

/**
 * POST /api/game/tutorial/claim-pin
 *
 * Idempotently grants the tutorial bonus enigma hint (a second
 * `enigma_suggerimento` seeded by migration 033) to the caller. The
 * "pin on the map" is purely a client-side overlay positioned near the
 * player's first GPS fix — there's no server-side pin row to verify
 * proximity against, so the only authorisation is that the caller is
 * authenticated and in the tutorial session. Worst-case abuse is a
 * player skipping the walk to grab the hint; for a free tutorial that's
 * acceptable.
 *
 * Returns `{ alreadyClaimed: boolean, suggerimentoId: string }`.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const rl = await rateLimit('tutorial_claim_pin', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const admin = createAdminClient()

  // Caller must be enrolled in the tutorial session
  const { data: ps } = await admin
    .from('player_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_id', TUTORIAL_SESSION_ID)
    .maybeSingle()
  if (!ps) {
    return NextResponse.json({ error: 'Tutorial non avviato' }, { status: 404 })
  }

  // Check existing claim — to return alreadyClaimed honestly
  const { data: existing } = await admin
    .from('player_enigma_suggerimenti')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_id', TUTORIAL_SESSION_ID)
    .eq('suggerimento_id', TUTORIAL_BONUS_SUGGERIMENTO_ID)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      alreadyClaimed: true,
      suggerimentoId: TUTORIAL_BONUS_SUGGERIMENTO_ID,
    })
  }

  const { error: insertError } = await admin
    .from('player_enigma_suggerimenti')
    .insert({
      user_id: user.id,
      session_id: TUTORIAL_SESSION_ID,
      suggerimento_id: TUTORIAL_BONUS_SUGGERIMENTO_ID,
    })

  if (insertError) {
    // 23505 → duplicate (race): treat as already claimed
    if ((insertError as any).code === '23505') {
      return NextResponse.json({
        alreadyClaimed: true,
        suggerimentoId: TUTORIAL_BONUS_SUGGERIMENTO_ID,
      })
    }
    return NextResponse.json(
      { error: 'Errore concessione indizio', detail: insertError.message },
      { status: 500 },
    )
  }

  // Bell notification
  admin.from('player_game_events').insert({
    user_id: user.id,
    session_id: TUTORIAL_SESSION_ID,
    type: 'enigma_hint_collected',
    payload: { suggerimento_id: TUTORIAL_BONUS_SUGGERIMENTO_ID, source: 'tutorial_pin' },
  }).then(undefined, () => {})

  return NextResponse.json({
    alreadyClaimed: false,
    suggerimentoId: TUTORIAL_BONUS_SUGGERIMENTO_ID,
  })
}
