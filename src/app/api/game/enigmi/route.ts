import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Carica enigmi: quelli della sessione + quelli globali (session_id IS NULL)
  const { data: enigmiData, error: enigmiError } = await admin
    .from('enigmi')
    .select('id, session_id, title, description, difficulty, reward_type, created_at, frammenti:enigma_frammenti(id, enigma_id, title, description, image_url, video_url, order_index), suggerimenti:enigma_suggerimenti(id, enigma_id, text, image_url, order_index)')
    .or(`session_id.eq.${sessionId},session_id.is.null`)
    .order('created_at', { ascending: true })

  if (enigmiError) return NextResponse.json({ error: enigmiError.message }, { status: 500 })

  // Carica frammenti del giocatore: creature catturate con enigma_frammento_id
  const { data: playerCreatures } = await admin
    .from('player_creatures')
    .select('creature_id, creatures!inner(enigma_frammento_id)')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .not('creatures.enigma_frammento_id', 'is', null)

  const collectedFrammentoIds = new Set<string>(
    (playerCreatures ?? [])
      .map((pc: any) => pc.creatures?.enigma_frammento_id)
      .filter(Boolean),
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
