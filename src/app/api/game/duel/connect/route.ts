import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Room code chars: exclude ambiguous 0, O, I, 1
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRoomCode(): string {
  return Array.from({ length: 4 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('')
}

interface LineupEntry { playerCreatureId: string; slot: number }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { sessionId, roomCode, lineup } = body as {
    sessionId: string
    roomCode?: string
    lineup: LineupEntry[]
  }

  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  // Guard: session must still be active
  const { data: sessionCheck } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'La sessione è terminata' }, { status: 403 })
  }

  if (!Array.isArray(lineup) || lineup.length !== 3) {
    return NextResponse.json({ error: 'La squadra deve avere esattamente 3 creature' }, { status: 400 })
  }
  const slots = lineup.map(l => l.slot).sort((a, b) => a - b)
  if (JSON.stringify(slots) !== '[1,2,3]') {
    return NextResponse.json({ error: 'Slot non validi — richiesti 1, 2, 3' }, { status: 400 })
  }

  // Validate ownership + fetch HP (and ATK for slot 1) for each lineup creature
  const hpMap = new Map<string, number>()
  let opponentSlot1Atk = 0
  for (const entry of lineup) {
    const { data: pc } = await supabase
      .from('player_creatures')
      .select('creatures(hp, atk)')
      .eq('id', entry.playerCreatureId)
      .eq('user_id', user.id)
      .single()
    if (!pc) return NextResponse.json({ error: 'Creatura non valida o non posseduta' }, { status: 400 })
    hpMap.set(entry.playerCreatureId, (pc as any).creatures?.hp ?? 100)
    if (entry.slot === 1) opponentSlot1Atk = (pc as any).creatures?.atk ?? 0
  }

  const slot1 = lineup.find(l => l.slot === 1)!

  // ── JOIN ───────────────────────────────────────────────────────────────────
  if (roomCode) {
    const { data: duel } = await supabase
      .from('duels')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .eq('session_id', sessionId)
      .eq('status', 'waiting')
      .single()

    if (!duel) return NextResponse.json({ error: 'Stanza non trovata o già iniziata' }, { status: 404 })
    if (duel.challenger_id === user.id) return NextResponse.json({ error: 'Sei già in questa stanza' }, { status: 409 })

    // Insert opponent lineups
    await supabase.from('duel_lineups').insert(
      lineup.map(entry => ({
        duel_id: duel.id,
        user_id: user.id,
        slot: entry.slot,
        player_creature_id: entry.playerCreatureId,
        current_hp: hpMap.get(entry.playerCreatureId) ?? 100,
        is_active: entry.slot === 1,
      }))
    )

    // Determine who goes first: lower slot-1 ATK attacks first
    const { data: challengerPc } = await supabase
      .from('player_creatures')
      .select('creatures(atk)')
      .eq('id', duel.challenger_creature_id)
      .single()
    const challengerSlot1Atk = (challengerPc as any)?.creatures?.atk ?? 0
    const firstTurn: 'challenger' | 'opponent' = challengerSlot1Atk <= opponentSlot1Atk ? 'challenger' : 'opponent'

    const { data: updated } = await supabase
      .from('duels')
      .update({
        opponent_id: user.id,
        opponent_creature_id: slot1.playerCreatureId,
        status: 'active',
        started_at: new Date().toISOString(),
        current_turn: firstTurn,
      })
      .eq('id', duel.id)
      .is('opponent_id', null)
      .select()
      .single()

    if (!updated) return NextResponse.json({ error: 'Stanza già occupata' }, { status: 409 })
    return NextResponse.json({ duelId: updated.id, role: 'opponent', roomCode: duel.room_code })
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────
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
      challenger_creature_id: slot1.playerCreatureId,
      session_id: sessionId,
      status: 'waiting',
      room_code: code,
    })
    .select()
    .single()

  if (createError) return NextResponse.json({ error: 'Errore creazione duello' }, { status: 500 })

  // Insert challenger lineups
  await supabase.from('duel_lineups').insert(
    lineup.map(entry => ({
      duel_id: duel.id,
      user_id: user.id,
      slot: entry.slot,
      player_creature_id: entry.playerCreatureId,
      current_hp: hpMap.get(entry.playerCreatureId) ?? 100,
      is_active: entry.slot === 1,
    }))
  )

  return NextResponse.json({ duelId: duel.id, role: 'challenger', roomCode: code })
}

// ── DELETE: cancel a waiting duel ─────────────────────────────────────────────
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { duelId } = body as { duelId?: string }

  if (!duelId) return NextResponse.json({ error: 'duelId richiesto' }, { status: 400 })

  await supabase
    .from('duels')
    .update({ status: 'cancelled', ended_at: new Date().toISOString() })
    .eq('id', duelId)
    .eq('challenger_id', user.id)
    .eq('status', 'waiting')

  return NextResponse.json({ cancelled: true })
}
