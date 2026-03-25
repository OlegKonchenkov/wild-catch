import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GameShell from '@/components/GameShell'

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Verify the player has at least one active/ready session; otherwise send to lobby
  const { data: ps } = await supabase
    .from('player_sessions')
    .select('session_id, sessions!inner(status)')
    .eq('user_id', user.id)
    .in('sessions.status', ['active', 'ready'])
    .limit(1)
    .maybeSingle()

  if (!ps) redirect('/home')

  return <GameShell>{children}</GameShell>
}
