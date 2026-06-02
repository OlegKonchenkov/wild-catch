import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  // Load unhatched eggs + current steps
  const [eggsRes, psRes] = await Promise.all([
    supabase
      .from('player_eggs')
      .select('id, egg_rarity, steps_required, steps_at_pickup, hatched_at, hatched_creature_id, created_at')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .is('hatched_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('player_sessions')
      .select('steps_walked')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .single(),
  ])

  const eggs = eggsRes.data ?? []
  const stepsWalked = (psRes.data as any)?.steps_walked ?? 0

  return NextResponse.json({
    eggs: eggs.map((egg: any) => ({
      ...egg,
      steps_walked_total: stepsWalked,
      steps_progress: Math.min(stepsWalked - egg.steps_at_pickup, egg.steps_required),
      can_hatch: egg.steps_required === 0 || (stepsWalked - egg.steps_at_pickup) >= egg.steps_required,
    })),
  })
}
