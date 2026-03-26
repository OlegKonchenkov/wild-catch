import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateFightDamage } from '@/lib/game/rng'
import { getElementMultiplier } from '@/lib/game/elements'
import type { Element } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { duelId, action, itemId } = await request.json()
  // action: 'attack' | 'surrender'
  // itemId: optional — inventory ID of a 'battaglia' item to use with this attack

  const { data: duel } = await supabase
    .from('duels')
    .select('*, challenger_creature:player_creatures!challenger_creature_id(*, creatures(*)), opponent_creature:player_creatures!opponent_creature_id(*, creatures(*))')
    .eq('id', duelId)
    .eq('status', 'active')
    .single()

  if (!duel) return NextResponse.json({ error: 'Duello non trovato' }, { status: 404 })

  const isChallenger = duel.challenger_id === user.id
  const isOpponent   = duel.opponent_id   === user.id
  if (!isChallenger && !isOpponent) return NextResponse.json({ error: 'Non sei in questo duello' }, { status: 403 })

  const myRole: 'challenger' | 'opponent' = isChallenger ? 'challenger' : 'opponent'

  // ── Surrender ──────────────────────────────────────────────────────────────
  if (action === 'surrender') {
    const winnerId = isChallenger ? duel.opponent_id : duel.challenger_id
    await supabase
      .from('duels')
      .update({ status: 'ended', winner_id: winnerId, ended_at: new Date().toISOString() })
      .eq('id', duelId)
    await awardDuelResults(supabase, duel.session_id, winnerId!, user.id)
    return NextResponse.json({ ended: true, winnerId })
  }

  // ── Turn check ─────────────────────────────────────────────────────────────
  if (duel.current_turn !== myRole) {
    return NextResponse.json({ error: 'Non è il tuo turno' }, { status: 409 })
  }

  // ── Creature stats ──────────────────────────────────────────────────────────
  const challengerCr = (duel as any).challenger_creature?.creatures
  const opponentCr   = (duel as any).opponent_creature?.creatures
  if (!challengerCr || !opponentCr) {
    return NextResponse.json({ error: 'Dati creature non disponibili' }, { status: 500 })
  }

  const attackerCr = isChallenger ? challengerCr : opponentCr
  const defenderCr = isChallenger ? opponentCr   : challengerCr

  // ── Optional battaglia item ────────────────────────────────────────────────
  let atkMultiplier = 1
  const sessionId = duel.session_id
  if (itemId) {
    const { data: invItem } = await supabase
      .from('player_inventory')
      .select('quantity, items(effect_value, type)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .single()

    const inv = invItem as { quantity: number; items: { effect_value: number; type: string } } | null
    if (inv && inv.quantity > 0 && inv.items?.type === 'battaglia') {
      atkMultiplier = 1 + (inv.items.effect_value ?? 0) / 100
      await supabase
        .from('player_inventory')
        .update({ quantity: inv.quantity - 1 })
        .eq('id', itemId)
    }
  }

  // ── Damage calculation ─────────────────────────────────────────────────────
  const mult   = getElementMultiplier(attackerCr.element as Element, defenderCr.element as Element)
  const damage = Math.round(calculateFightDamage(attackerCr.atk) * mult * atkMultiplier)

  // ── Update HP server-side ──────────────────────────────────────────────────
  const defenderHpField: 'challenger_hp' | 'opponent_hp' = isChallenger ? 'opponent_hp' : 'challenger_hp'
  const currentDefenderHp: number = isChallenger ? (duel.opponent_hp ?? defenderCr.hp) : (duel.challenger_hp ?? defenderCr.hp)
  const newDefenderHp = Math.max(0, currentDefenderHp - damage)
  const nextTurn: 'challenger' | 'opponent' = isChallenger ? 'opponent' : 'challenger'

  const duelOver = newDefenderHp === 0

  const updatePayload: Record<string, unknown> = {
    [defenderHpField]: newDefenderHp,
    current_turn: duelOver ? null : nextTurn,
  }
  if (duelOver) {
    updatePayload.status    = 'ended'
    updatePayload.winner_id = user.id
    updatePayload.ended_at  = new Date().toISOString()
  }

  await supabase.from('duels').update(updatePayload).eq('id', duelId)

  if (duelOver) {
    const loserId = isChallenger ? duel.opponent_id : duel.challenger_id
    await awardDuelResults(supabase, sessionId, user.id, loserId!)
  }

  // ── Broadcast to both players ──────────────────────────────────────────────
  const channel = supabase.channel(`duel:${duelId}`)
  await new Promise<void>(resolve => channel.subscribe(() => resolve()))
  await channel.send({
    type: 'broadcast',
    event: 'duel_action',
    payload: {
      actorId: user.id,
      action,
      damage,
      elementMultiplier: mult,
      itemUsed: atkMultiplier > 1,
      nextTurn: duelOver ? null : nextTurn,
      newDefenderHp,
    },
  })
  await supabase.removeChannel(channel)

  return NextResponse.json({ damage, elementMultiplier: mult, nextTurn: duelOver ? null : nextTurn, duelOver })
}

async function awardDuelResults(supabase: any, sessionId: string, winnerId: string, loserId: string) {
  await supabase.rpc('increment_player_stats', { p_user_id: winnerId, p_session_id: sessionId, p_exp: 15, p_score: 15 })
  await supabase.rpc('increment_player_stats', { p_user_id: loserId,  p_session_id: sessionId, p_exp: 5,  p_score: 0  })
}
