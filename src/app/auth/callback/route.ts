import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Admin login with explicit redirect target
      if (next) return NextResponse.redirect(`${origin}${next}`)

      // Check if user already has an active player session (re-login or new device)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existing } = await supabase
          .from('player_sessions')
          .select('session_id, sessions!inner(status)')
          .eq('user_id', user.id)
          .in('sessions.status', ['active', 'ready'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (existing?.session_id) {
          // Returning player — skip join form, restore sessionId on the client
          return NextResponse.redirect(
            `${origin}/game/map?restored=${existing.session_id}`
          )
        }
      }

      // New player or no active session — go to lobby
      return NextResponse.redirect(`${origin}/home`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
