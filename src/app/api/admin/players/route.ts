import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin')
  if (rpcError) return { error: 'Errore verifica ruolo', status: 500 }
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const admin = createAdminClient()

  const { data: playerSessions, error } = await admin
    .from('player_sessions')
    .select('user_id, level, exp, score, gold, created_at')
    .eq('session_id', sessionId)
    .order('score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch only the users we need by querying each user_id
  const userIds = (playerSessions ?? []).map((ps: { user_id: string }) => ps.user_id)
  const emailMap = new Map<string, string>()

  if (userIds.length > 0) {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })
    const relevantIds = new Set(userIds)
    for (const u of usersData.users) {
      if (relevantIds.has(u.id)) emailMap.set(u.id, u.email ?? '')
    }
  }

  const players = (playerSessions ?? []).map((ps: { user_id: string; level: number; exp: number; score: number; gold: number; created_at: string }) => ({
    userId: ps.user_id,
    email: emailMap.get(ps.user_id) ?? '',
    level: ps.level,
    exp: ps.exp,
    score: ps.score,
    gold: ps.gold,
    joinedAt: ps.created_at,
  }))

  return NextResponse.json({ players })
}
