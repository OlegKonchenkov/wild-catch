import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/auth/restore
// Returns the most recent active player_session for the authenticated user.
// Used to re-hydrate localStorage on re-login or new device.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ sessionId: null })

  // Find the most recent player_session that belongs to an active/ready session
  const { data } = await supabase
    .from('player_sessions')
    .select('session_id, sessions!inner(status)')
    .eq('user_id', user.id)
    .in('sessions.status', ['active', 'ready', 'ended'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ sessionId: data?.session_id ?? null })
}
