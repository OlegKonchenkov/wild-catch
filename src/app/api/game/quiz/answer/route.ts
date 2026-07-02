import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispenseReward, type RewardType } from '@/lib/game/rewards/dispense'
import type { Json } from '@/types/database'

/** Ricompensa di default quando il quiz non ne configura una. */
const DEFAULT_QUIZ_REWARD = [{ type: 'gemme', payload: { amount: 5 } }]

// POST /api/game/quiz/answer — body: { quizId, sessionId, answerIndex }
// Tentativi illimitati (fine educativo); la ricompensa è erogata SOLO alla
// prima risposta corretta (solved_at è il gate).
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { quizId, sessionId, answerIndex } = await request.json().catch(() => ({}))
  if (!quizId || !sessionId || answerIndex == null) {
    return NextResponse.json({ error: 'quizId, sessionId e answerIndex richiesti' }, { status: 400 })
  }

  const { data: sessionCheck } = await supabase
    .from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'Sessione non attiva' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: quiz } = await admin
    .from('quizzes')
    .select('id, correct_index, reward, unlock_anecdote_id, question')
    .eq('id', quizId)
    .single()
  if (!quiz) return NextResponse.json({ error: 'Quiz non trovato' }, { status: 404 })

  // Gate di sblocco: serve l'aneddoto collegato
  if (quiz.unlock_anecdote_id) {
    const { data: owned } = await supabase
      .from('player_collection')
      .select('id')
      .eq('user_id', user.id).eq('session_id', sessionId)
      .eq('kind', 'aneddoto').eq('ref_id', quiz.unlock_anecdote_id)
      .maybeSingle()
    if (!owned) {
      return NextResponse.json({ error: 'Quiz bloccato: trova prima l\'aneddoto collegato', locked: true }, { status: 403 })
    }
  }

  // Stato attuale
  const { data: state } = await supabase
    .from('player_quizzes')
    .select('id, attempts, solved_at')
    .eq('user_id', user.id).eq('session_id', sessionId).eq('quiz_id', quizId)
    .maybeSingle()

  if (state?.solved_at) {
    return NextResponse.json({ error: 'Quiz già risolto', alreadySolved: true }, { status: 409 })
  }

  const correct = Number(answerIndex) === quiz.correct_index
  const now = new Date().toISOString()

  if (state) {
    await supabase.from('player_quizzes')
      .update({ attempts: state.attempts + 1, ...(correct ? { solved_at: now } : {}) })
      .eq('id', state.id)
  } else {
    const { error: insErr } = await supabase.from('player_quizzes').insert({
      user_id: user.id, session_id: sessionId, quiz_id: quizId,
      attempts: 1, ...(correct ? { solved_at: now } : {}),
    })
    // Corsa concorrente sulla prima risposta: riprova come update
    if (insErr?.code === '23505' && correct) {
      const { data: retry } = await supabase.from('player_quizzes')
        .select('id, attempts, solved_at')
        .eq('user_id', user.id).eq('session_id', sessionId).eq('quiz_id', quizId)
        .single()
      if (retry?.solved_at) return NextResponse.json({ error: 'Quiz già risolto', alreadySolved: true }, { status: 409 })
      if (retry) await supabase.from('player_quizzes')
        .update({ attempts: retry.attempts + 1, solved_at: now }).eq('id', retry.id)
    }
  }

  if (!correct) {
    return NextResponse.json({ correct: false })
  }

  // Prima risposta corretta → eroga la ricompensa
  const rewards = (Array.isArray(quiz.reward) && (quiz.reward as any[]).length > 0
    ? quiz.reward as Array<{ type: string; payload: Record<string, any> }>
    : DEFAULT_QUIZ_REWARD)
  const drops = []
  for (const r of rewards) {
    drops.push(await dispenseReward(admin, {
      userId: user.id, sessionId, type: r.type as RewardType, payload: r.payload ?? {},
    }))
  }

  admin.from('player_game_events').insert({
    user_id: user.id, session_id: sessionId, type: 'quiz_solved',
    payload: { question: quiz.question, drop_count: drops.length } as Json,
  }).then(undefined, () => {})

  return NextResponse.json({ correct: true, drops })
}
