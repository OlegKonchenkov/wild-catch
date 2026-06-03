import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/auth/restore
// Returns the most recent active player_session for the authenticated user.
// Used to re-hydrate localStorage on re-login or new device.
export async function GET() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ sessionId: null })

  // Find the most recent player_session that belongs to an active/ready session
  const { data } = await supabase
    .from('player_sessions')
    .select('session_id, sessions!inner(status)')
    .eq('user_id', user.id)
    .in('sessions.status', ['active', 'ready', 'ended'])
    // player_sessions has `joined_at`, not `created_at`. The wrong column made
    // PostgREST error, so new-device/re-login restore always returned null.
    .order('joined_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ sessionId: data?.session_id ?? null })
}
