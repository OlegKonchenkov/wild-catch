import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/game/profile?sessionId=X
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  // Three independent reads — fan out in parallel (1 round-trip instead of 3).
  const [psRes, profileRes, ccRes] = await Promise.all([
    supabase
      .from('player_sessions')
      .select('exp, gold, gemme, level')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .single(),
    supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('player_creatures')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('session_id', sessionId),
  ])

  const ps = psRes.data
  if (!ps) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // No Cache-Control. exp/gold/level/creatures_caught change on every catch and
  // the HUD reads this right after; caching produced stale stats. On NANO the
  // perf benefit is negligible (the bottleneck is compute, not this query).
  return NextResponse.json({
    exp: ps.exp ?? 0,
    gold: ps.gold ?? 0,
    gemme: (ps as { gemme?: number }).gemme ?? 0,
    level: ps.level ?? 1,
    nickname: profileRes.data?.nickname ?? 'Anonimo',
    avatar_url: profileRes.data?.avatar_url ?? null,
    creatures_caught: ccRes.count ?? 0,
  })
}
