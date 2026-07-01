import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { incrementMissionProgress } from '@/lib/game/missions'
import { grantAbility } from '@/lib/game/grant-ability'
import { logSessionError } from '@/lib/logSessionError'
import { isTutorialSession } from '@/lib/game/tutorial'

/**
 * POST /api/game/enigmi/solve — body `{ enigmaId, sessionId, answer }`.
 *
 * Compares a normalized answer (lowercased + trimmed + collapsed whitespace)
 * to the stored solution. On success:
 *  - records the solve in player_enigmi (idempotent via UNIQUE)
 *  - grants reward_payload according to reward_type
 *  - fires an 'enigma' mission event with target=enigmaId so the tutorial
 *    closing mission can complete
 *
 * Returns `{ correct, alreadySolved?, reward? }`. We never reveal the
 * solution on incorrect attempts.
 */
function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const rl = await rateLimit('enigma_solve', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const body = await request.json().catch(() => ({})) as {
    enigmaId?: string
    sessionId?: string
    answer?: string
  }
  const { enigmaId, sessionId, answer } = body
  if (!enigmaId || !sessionId || typeof answer !== 'string') {
    return NextResponse.json({ error: 'enigmaId, sessionId e answer richiesti' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Ensure the player is in this session (cheap auth check)
  const { data: ps } = await admin
    .from('player_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!ps) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // Load the enigma (admin client so we can read solution)
  const { data: enigma } = await admin
    .from('enigmi')
    .select('id, session_id, solution, reward_type, reward_payload, title')
    .eq('id', enigmaId)
    .maybeSingle()
  if (!enigma) return NextResponse.json({ error: 'Enigma non trovato' }, { status: 404 })

  // Scope check: enigma must be either global (session_id IS NULL) or
  // belong to this session. Tutorial is isolated — globals are off-limits.
  if (enigma.session_id != null && enigma.session_id !== sessionId) {
    return NextResponse.json({ error: 'Enigma non disponibile in questa sessione' }, { status: 403 })
  }
  if (isTutorialSession(sessionId) && enigma.session_id == null) {
    return NextResponse.json({ error: 'Enigma non disponibile nel tutorial' }, { status: 403 })
  }

  // Already solved? Idempotent — no double rewards.
  const { data: existingSolve } = await admin
    .from('player_enigmi')
    .select('id, solved_at')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('enigma_id', enigmaId)
    .maybeSingle()
  if (existingSolve) {
    return NextResponse.json({ correct: true, alreadySolved: true })
  }

  // Compare
  const isCorrect = normalize(answer) === normalize(enigma.solution ?? '')
  if (!isCorrect) {
    logSessionError({
      sessionId, userId: user.id, source: 'enigma',
      errorCode: 'wrong_answer',
      message: `Tentativo enigma "${enigma.title}" errato`,
      context: { enigmaId },
    })
    return NextResponse.json({ correct: false })
  }

  // Record the solve. Race-safe via UNIQUE — if a concurrent solve already
  // landed, we treat it as alreadySolved.
  const { error: insertError } = await admin
    .from('player_enigmi')
    .insert({ user_id: user.id, session_id: sessionId, enigma_id: enigmaId })
  if (insertError) {
    // Duplicate key → another request beat us. Treat as alreadySolved (no double reward).
    if ((insertError as any).code === '23505') {
      return NextResponse.json({ correct: true, alreadySolved: true })
    }
    return NextResponse.json({ error: 'Errore registrazione', detail: insertError.message }, { status: 500 })
  }

  // Grant reward
  const reward: { gold?: number; exp?: number; itemId?: string; creatureId?: string; abilityId?: string } = {}
  const payload = (enigma.reward_payload ?? {}) as Record<string, any>

  if (enigma.reward_type === 'gold' || (typeof payload.gold === 'number' && payload.gold > 0)) {
    const gold = Number(payload.gold) || 0
    if (gold > 0) {
      const { data: psRow } = await admin
        .from('player_sessions')
        .select('gold')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single()
      if (psRow) {
        await admin
          .from('player_sessions')
          .update({ gold: (psRow.gold ?? 0) + gold })
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
        reward.gold = gold
      }
    }
  }

  if (enigma.reward_type === 'exp' || (typeof payload.exp === 'number' && payload.exp > 0)) {
    const exp = Number(payload.exp) || 0
    if (exp > 0) {
      await admin.rpc('increment_player_stats', {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_exp: exp,
        p_score: 0,
      })
      reward.exp = exp
    }
  }

  // Ability token reward (reward_type 'abilita' or an abilityId in the payload)
  if (enigma.reward_type === 'abilita' || payload.abilityId || payload.ability_id) {
    const abilityId = payload.abilityId ?? payload.ability_id
    const qty = Number(payload.quantity) || 1
    if (abilityId) {
      const r = await grantAbility(admin, user.id, sessionId, abilityId, qty)
      if (r.granted) reward.abilityId = abilityId
    }
  }

  // Bell notification
  admin.from('player_game_events').insert({
    user_id: user.id,
    session_id: sessionId,
    type: 'enigma_solved',
    payload: { enigma_id: enigmaId, title: enigma.title, reward },
  }).then(undefined, () => {})

  // Mission progress: any 'enigma'-type mission targeting this enigma id
  const completedMissions = await incrementMissionProgress({
    type: 'enigma',
    target: enigmaId,
    userId: user.id,
    sessionId,
  }).catch(() => [])

  return NextResponse.json({
    correct: true,
    alreadySolved: false,
    reward,
    completedMissions,
  })
}
