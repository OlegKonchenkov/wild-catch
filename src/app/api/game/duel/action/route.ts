import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateFightDamage } from '@/lib/game/rng'
import { getElementMultiplier } from '@/lib/game/elements'
import type { Element } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { duelId, action } = await request.json()
  // action: 'attack' | 'surrender'

  const { data: duel } = await supabase
    .from('duels')
    .select('*, challenger_creature:player_creatures!challenger_creature_id(*, creatures(*)), opponent_creature:player_creatures!opponent_creature_id(*, creatures(*))')
    .eq('id', duelId)
    .eq('status', 'active')
    .single()

  if (!duel) return NextResponse.json({ error: 'Duello non trovato' }, { status: 404 })

  const isChallenger = duel.challenger_id === user.id
  const isOpponent = duel.opponent_id === user.id
  if (!isChallenger && !isOpponent) return NextResponse.json({ error: 'Non sei in questo duello' }, { status: 403 })

  if (action === 'surrender') {
    const winnerId = isChallenger ? duel.opponent_id : duel.challenger_id
    await supabase.from('duels').update({ status: 'ended', winner_id: winnerId, ended_at: new Date().toISOString() }).eq('id', duelId)
    await awardDuelResults(supabase, duel.session_id, winnerId!, user.id)
    return NextResponse.json({ ended: true, winner: 'opponent' })
  }

  // Get creature stats from the FK-joined data
  const challengerCr = (duel as any).challenger_creature?.creatures
  const opponentCr = (duel as any).opponent_creature?.creatures

  if (!challengerCr || !opponentCr) {
    return NextResponse.json({ error: 'Dati creature non disponibili' }, { status: 500 })
  }

  const attackerCr = isChallenger ? challengerCr : opponentCr
  const defenderCr = isChallenger ? opponentCr : challengerCr

  const mult = getElementMultiplier(attackerCr.element as Element, defenderCr.element as Element)
  const damage = Math.round(calculateFightDamage(attackerCr.atk) * mult)

  // Broadcast action via Supabase Realtime to both players
  await supabase.channel(`duel:${duelId}`).send({
    type: 'broadcast',
    event: 'duel_action',
    payload: {
      actorId: user.id,
      action,
      damage,
      elementMultiplier: mult,
    },
  })

  return NextResponse.json({ damage, elementMultiplier: mult, action })
}

async function awardDuelResults(supabase: any, sessionId: string, winnerId: string, loserId: string) {
  await supabase.rpc('increment_player_stats', { p_user_id: winnerId, p_session_id: sessionId, p_exp: 15, p_score: 15 })
  await supabase.rpc('increment_player_stats', { p_user_id: loserId, p_session_id: sessionId, p_exp: 5, p_score: 0 })
}
