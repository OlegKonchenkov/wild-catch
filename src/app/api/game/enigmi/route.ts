import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isTutorialSession } from '@/lib/game/tutorial'

// GET /api/game/enigmi?sessionId=<uuid>
// Restituisce tutti gli enigmi (di sessione + globali) con i frammenti e suggerimenti raccolti dal giocatore.
// La soluzione non viene mai inviata al client.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const admin = createAdminClient()

  // Real events include the session's enigmi + global ones; the tutorial
  // session is isolated so its enigma list stays clean (just the seeded
  // "L'Essenza del Daimon").
  const enigmiBase = admin
    .from('enigmi')
    .select('id, session_id, title, description, difficulty, reward_type, created_at, frammenti:enigma_frammenti(id, enigma_id, title, description, image_url, video_url, order_index), suggerimenti:enigma_suggerimenti(id, enigma_id, text, image_url, order_index)')
    .order('created_at', { ascending: true })
  const { data: enigmiData, error: enigmiError } = await (isTutorialSession(sessionId)
    ? enigmiBase.eq('session_id', sessionId)
    : enigmiBase.or(`session_id.eq.${sessionId},session_id.is.null`))

  if (enigmiError) return NextResponse.json({ error: enigmiError.message }, { status: 500 })

  // Carica frammenti del giocatore: due fonti unite
  //   (a) creature catturate il cui enigma_frammento_id ≠ null (flusso base)
  //   (b) grant diretti su player_enigma_frammenti (tutorial / future ricompense)
  const [{ data: playerCreatures }, { data: directFrammenti }] = await Promise.all([
    admin
      .from('player_creatures')
      .select('creature_id, creatures!inner(enigma_frammento_id)')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .not('creatures.enigma_frammento_id', 'is', null),
    admin
      .from('player_enigma_frammenti')
      .select('frammento_id')
      .eq('user_id', user.id)
      .eq('session_id', sessionId),
  ])

  const collectedFrammentoIds = new Set<string>([
    ...((playerCreatures ?? []) as any[])
      .map(pc => pc.creatures?.enigma_frammento_id)
      .filter(Boolean),
    ...((directFrammenti ?? []) as any[]).map(d => d.frammento_id),
  ])

  // Carica enigmi risolti per marcare lo status
  const { data: solvedRows } = await admin
    .from('player_enigmi')
    .select('enigma_id')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
  const solvedEnigmaIds = new Set<string>(
    ((solvedRows ?? []) as any[]).map(r => r.enigma_id),
  )

  // Carica suggerimenti del giocatore
  const { data: playerSuggerimenti } = await admin
    .from('player_enigma_suggerimenti')
    .select('suggerimento_id')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)

  const collectedSuggerimentoIds = new Set<string>(
    (playerSuggerimenti ?? []).map((ps: any) => ps.suggerimento_id),
  )

  // Costruisci la risposta: per ogni enigma, marca frammenti e suggerimenti come raccolti o no
  // La soluzione NON viene mai inclusa
  const enigmi = (enigmiData ?? []).map((enigma: any) => {
    const frammenti = (enigma.frammenti ?? [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((f: any) => {
        const collected = collectedFrammentoIds.has(f.id)
        return {
          id: f.id,
          enigma_id: f.enigma_id,
          order_index: f.order_index,
          collected,
          // Contenuto visibile solo se raccolto
          title: collected ? f.title : null,
          description: collected ? f.description : null,
          image_url: collected ? f.image_url : null,
          video_url: collected ? f.video_url : null,
        }
      })

    const suggerimenti = (enigma.suggerimenti ?? [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((s: any) => {
        const collected = collectedSuggerimentoIds.has(s.id)
        return {
          id: s.id,
          enigma_id: s.enigma_id,
          order_index: s.order_index,
          collected,
          // Contenuto visibile solo se raccolto
          text: collected ? s.text : null,
          image_url: collected ? s.image_url : null,
        }
      })

    return {
      id: enigma.id,
      session_id: enigma.session_id,
      title: enigma.title,
      description: enigma.description,
      difficulty: enigma.difficulty,
      reward_type: enigma.reward_type,
      solved: solvedEnigmaIds.has(enigma.id),
      frammenti,
      suggerimenti,
      frammenti_collected: frammenti.filter((f: any) => f.collected).length,
      frammenti_total: frammenti.length,
      suggerimenti_collected: suggerimenti.filter((s: any) => s.collected).length,
      suggerimenti_total: suggerimenti.length,
    }
  })

  return NextResponse.json({ enigmi })
}
