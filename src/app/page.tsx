import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Login from './_components/Login'

// Server-side gate: if the user already has a Supabase session cookie, redirect
// to /game/map (for an active/ready/ended player_session) or /home.
// Returning users never see the client-side splash that used to validate auth.
export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: existing } = await supabase
      .from('player_sessions')
      .select('session_id, sessions!inner(status)')
      .eq('user_id', user.id)
      .in('sessions.status', ['active', 'ready', 'ended'])
      // player_sessions has `joined_at`, not `created_at` — wrong column errored
      // and broke the landing-page auto-resume into the user's active session.
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.session_id) {
      redirect(`/game/map?restored=${existing.session_id}`)
    }
    redirect('/home')
  }

  return <Login />
}
