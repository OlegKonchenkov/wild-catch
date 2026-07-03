import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await request.json()
  const { name, narrativeConfig, areaBounds, durationMinutes, starterKit, kind, dailyRewardsEnabled, dailyPackId, endAt } = body

  // Mode: 'event' (default, timed escape-room) or 'avventura' (persistent).
  // 'tutorial' is seeded by migration, never creatable from the UI.
  const sessionKind: 'event' | 'avventura' = kind === 'avventura' ? 'avventura' : 'event'
  const isAvventura = sessionKind === 'avventura'

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      name,
      kind: sessionKind,
      narrative_config: narrativeConfig,
      area_bounds: areaBounds,
      duration_minutes: durationMinutes,
      status: 'draft',
      starter_kit: Array.isArray(starterKit) && starterKit.length > 0 ? starterKit : null,
      // Avventura: no auto-close unless an explicit optional deadline is set.
      ...(isAvventura ? {
        auto_end: !!endAt,
        end_at: endAt ?? null,
        // Daily rewards default ON for avventura when the field is omitted.
        daily_rewards_enabled: dailyRewardsEnabled !== undefined ? !!dailyRewardsEnabled : true,
        daily_pack_id: dailyPackId ?? null,
      } : {
        daily_rewards_enabled: !!dailyRewardsEnabled,
        daily_pack_id: dailyPackId ?? null,
      }),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessionId: data.id })
}
