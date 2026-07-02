import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

// GET /api/admin/packs — list pack catalogue (for grant/reward pickers).
export async function GET() {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('packs')
    .select('id, name, rarity, min_drops, max_drops')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ packs: data ?? [] })
}
