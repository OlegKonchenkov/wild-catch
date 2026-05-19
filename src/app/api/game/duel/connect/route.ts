import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scaleCombatStats } from '@/lib/game/combat'
import { getEquipmentBonuses } from '@/lib/game/equipment'

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
    const notStarted = sessionCheck?.status === 'draft' || sessionCheck?.status === 'ready'
    const errMsg = notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
    return NextResponse.json({ error: errMsg }, { status: 403 })
  }

  if (!Array.isArray(lineup) || lineup.length < 1 || lineup.length > 3) {
    return NextResponse.json({ error: 'La squadra deve avere tra 1 e 3 creature' }, { status: 400 })
  }
  const slots = lineup.map(l => l.slot)
  if (slots.some((s: number) => s < 1 || s > 3) || new Set(slots).size !== slots.length) {
    return NextResponse.json({ error: 'Slot non validi — usare slot 1, 2 o 3 (unici)' }, { status: 400 })
  }

  // Validate ownership + fetch HP (and ATK for slot 1) for each lineup creature
  const { data: playerSession } = await supabase
    .from('player_sessions')
    .select('level')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .maybeSingle()
  const playerLevel = playerSession?.level ?? 1

  const hpMap = new Map<string, number>()
  let opponentSlot1Atk = 0
  const equipBonusMap = await getEquipmentBonuses(supabase, lineup.map(l => l.playerCreatureId))
  for (const entry of lineup) {
    const { data: pc } = await supabase
      .from('player_creatures')
      .select('creatures(hp, atk, def)')
      .eq('id', entry.playerCreatureId)
      .eq('user_id', user.id)
      .single()
    if (!pc) return NextResponse.json({ error: 'Creatura non valida o non posseduta' }, { status: 400 })
    const creature = (pc as any).creatures
    const scaledStats = scaleCombatStats(
      { hp: creature?.hp ?? 100, atk: creature?.atk ?? 0, def: creature?.def ?? 0 },
      playerLevel,
      equipBonusMap.get(entry.playerCreatureId) ?? { hp: 0, atk: 0, def: 0 },
    )
    hpMap.set(entry.playerCreatureId, scaledStats.hp)
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

    // Determine who goes first: lower slot-1 ATK attacks first.
    // Must use admin client because the opponent can't read the challenger's player_creatures via RLS.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data: challengerPc } = await admin
      .from('player_creatures')
      .select('creatures(atk)')
      .eq('id', duel.challenger_creature_id)
      .single()
    const challengerSlot1Atk = (challengerPc as any)?.creatures?.atk ?? 0
    const firstTurn: 'challenger' | 'opponent' = challengerSlot1Atk <= opponentSlot1Atk ? 'challenger' : 'opponent'

    // Atomically claim the opponent slot FIRST — if a concurrent joiner
    // beat us we abort cleanly without inserting our lineup. The previous
    // order (lineups → update) could leave orphan duel_lineups rows
    // belonging to "us" in someone else's duel.
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

    // Now safe to insert the opponent lineup — the duel is exclusively ours.
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
