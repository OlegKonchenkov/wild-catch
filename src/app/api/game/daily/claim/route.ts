import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispenseReward, type RewardType } from '@/lib/game/rewards/dispense'
import { romeDateKey, computeStreak, buildDailyRewards } from '@/lib/game/daily'
import type { Json } from '@/types/database'

// POST /api/game/daily/claim — body: { sessionId }
// Claims today's login reward (Europe/Rome day). The UNIQUE(user, session,
// claim_date) constraint is the idempotency backstop: a concurrent double
// claim collides on insert and gets a clean 409.
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId } = await request.json().catch(() => ({}))
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const { data: session } = await supabase
    .from('sessions')
    .select('status, daily_rewards_enabled, daily_pack_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.status !== 'active') {
    return NextResponse.json({ error: 'Sessione non attiva' }, { status: 403 })
  }
  if (!(session as { daily_rewards_enabled?: boolean }).daily_rewards_enabled) {
    return NextResponse.json({ error: 'Premi giornalieri non attivi in questa sessione' }, { status: 403 })
  }

  const today = romeDateKey()

  // Most recent claim → streak computation
  const { data: last } = await supabase
    .from('player_daily_claims')
    .select('claim_date, streak')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .order('claim_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (last?.claim_date === today) {
    return NextResponse.json({ error: 'Premio già riscosso oggi', alreadyClaimed: true }, { status: 409 })
  }

  const streak = computeStreak(last ?? null, today)
  const rewards = buildDailyRewards(streak, (session as { daily_pack_id?: string | null }).daily_pack_id ?? null)

  // Insert FIRST (idempotency gate), then dispense.
  const { error: insertErr } = await supabase.from('player_daily_claims').insert({
    user_id: user.id, session_id: sessionId,
    claim_date: today, streak, reward: rewards as unknown as Json,
  })
  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'Premio già riscosso oggi', alreadyClaimed: true }, { status: 409 })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const admin = createAdminClient()
  const drops = []
  for (const r of rewards) {
    drops.push(await dispenseReward(admin, {
      userId: user.id, sessionId, type: r.type as RewardType, payload: r.payload as Record<string, any>,
    }))
  }

  admin.from('player_game_events').insert({
    user_id: user.id, session_id: sessionId, type: 'daily_claimed',
    payload: { streak, drop_count: drops.length } as Json,
  }).then(undefined, () => {})

  return NextResponse.json({ success: true, streak, drops })
}
