import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { isTutorialSession } from '@/lib/game/tutorial'

// GET /api/game/quiz?sessionId=...
// Lista quiz (sessione + globali; tutorial isolato) con stato del giocatore.
// correct_index NON viene mai incluso nella risposta (stessa disciplina delle
// soluzioni degli enigmi) — per questo si legge con l'admin client.
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const admin = createAdminClient()

  const quizBase = admin
    .from('quizzes')
    .select('id, session_id, place_id, unlock_anecdote_id, question, options, reward, created_at, anecdote:anecdotes(id, title)')
    .order('created_at', { ascending: true })
  const { data: quizRows, error } = await (isTutorialSession(sessionId)
    ? quizBase.eq('session_id', sessionId)
    : quizBase.or(`session_id.eq.${sessionId},session_id.is.null`))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [{ data: states }, { data: ownedAnecdotes }] = await Promise.all([
    supabase.from('player_quizzes')
      .select('quiz_id, attempts, solved_at')
      .eq('user_id', user.id).eq('session_id', sessionId),
    supabase.from('player_collection')
      .select('ref_id')
      .eq('user_id', user.id).eq('session_id', sessionId).eq('kind', 'aneddoto'),
  ])

  const stateByQuiz = new Map((states ?? []).map((s: any) => [s.quiz_id, s]))
  const ownedAnecdoteIds = new Set((ownedAnecdotes ?? []).map((r: any) => r.ref_id))

  const quizzes = (quizRows ?? []).map((q: any) => {
    const st = stateByQuiz.get(q.id)
    const locked = !!q.unlock_anecdote_id && !ownedAnecdoteIds.has(q.unlock_anecdote_id)
    return {
      id: q.id,
      place_id: q.place_id,
      question: locked ? null : q.question,        // niente spoiler da bloccato
      options: locked ? [] : (q.options ?? []),
      locked,
      unlockAnecdoteTitle: locked ? ((q.anecdote as any)?.title ?? null) : null,
      solved: !!st?.solved_at,
      attempts: st?.attempts ?? 0,
      // correct_index intenzionalmente omesso
    }
  })

  return NextResponse.json({ quizzes })
}
