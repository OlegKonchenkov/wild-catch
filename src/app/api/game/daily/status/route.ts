import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { romeDateKey, prevDateKey } from '@/lib/game/daily'

// GET /api/game/daily/status?sessionId=...
// → { enabled, claimedToday, streak }
//   streak = the streak the player currently "holds": last claim's value if the
//   last claim was today or yesterday (still alive), otherwise 0 (broken).
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const { data: session } = await supabase
    .from('sessions')
    .select('status, daily_rewards_enabled')
    .eq('id', sessionId)
    .single()

  const enabled = !!session && session.status === 'active' && !!(session as { daily_rewards_enabled?: boolean }).daily_rewards_enabled
  if (!enabled) return NextResponse.json({ enabled: false, claimedToday: false, streak: 0 })

  const { data: last } = await supabase
    .from('player_daily_claims')
    .select('claim_date, streak')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .order('claim_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const today = romeDateKey()
  const claimedToday = last?.claim_date === today
  const alive = claimedToday || last?.claim_date === prevDateKey(today)

  return NextResponse.json({
    enabled: true,
    claimedToday,
    streak: alive ? (last?.streak ?? 0) : 0,
  })
}
