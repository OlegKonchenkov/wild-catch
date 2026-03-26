import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Room code chars: exclude ambiguous 0, O, I, 1
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRoomCode(): string {
  return Array.from({ length: 4 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { sessionId, roomCode, playerCreatureId } = body

  if (!sessionId || !playerCreatureId) {
    return NextResponse.json({ error: 'sessionId e playerCreatureId richiesti' }, { status: 400 })
  }

  if (roomCode) {
    // Join existing duel
    const { data: duel } = await supabase
      .from('duels')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .eq('session_id', sessionId)
      .eq('status', 'waiting')
      .single()

    if (!duel) return NextResponse.json({ error: 'Stanza non trovata o già iniziata' }, { status: 404 })
    if (duel.challenger_id === user.id) return NextResponse.json({ error: 'Sei già in questa stanza' }, { status: 409 })

    // Fetch both creatures' base HP to initialise server-side HP tracking
    const [{ data: challengerPc }, { data: opponentPc }] = await Promise.all([
      supabase
        .from('player_creatures')
        .select('creatures(hp)')
        .eq('id', duel.challenger_creature_id)
        .single(),
      supabase
        .from('player_creatures')
        .select('creatures(hp)')
        .eq('id', playerCreatureId)
        .single(),
    ])
    const challengerHp = (challengerPc as any)?.creatures?.hp ?? 100
    const opponentHp   = (opponentPc  as any)?.creatures?.hp ?? 100

    const { data: updated } = await supabase
      .from('duels')
      .update({
        opponent_id: user.id,
        opponent_creature_id: playerCreatureId,
        status: 'active',
        started_at: new Date().toISOString(),
        current_turn: 'challenger',
        challenger_hp: challengerHp,
        opponent_hp: opponentHp,
      })
      .eq('id', duel.id)
      .is('opponent_id', null)
      .select()
      .single()

    if (!updated) return NextResponse.json({ error: 'Stanza già occupata' }, { status: 409 })
    return NextResponse.json({ duelId: updated.id, role: 'opponent', roomCode: duel.room_code })
  } else {
    // Create new duel — retry on room code collision
    let code = generateRoomCode()
    let attempts = 0

    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('duels')
        .select('id')
        .eq('room_code', code)
        .eq('session_id', sessionId)
        .eq('status', 'waiting')
        .maybeSingle()

      if (!existing) break
      code = generateRoomCode()
      attempts++
    }

    const { data: duel, error: createError } = await supabase
      .from('duels')
      .insert({
        challenger_id: user.id,
        challenger_creature_id: playerCreatureId,
        session_id: sessionId,
        status: 'waiting',
        room_code: code,
      })
      .select()
      .single()

    if (createError) return NextResponse.json({ error: 'Errore creazione duello' }, { status: 500 })

    return NextResponse.json({ duelId: duel.id, role: 'challenger', roomCode: code })
  }
}
