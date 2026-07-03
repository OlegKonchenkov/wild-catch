import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/game/groups → il mio gruppo (o null)
export async function GET() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, group:groups(id, name, code)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) return NextResponse.json({ group: null })
  const g = membership.group as unknown as { id: string; name: string; code: string } | null

  // Quanti membri (per il flavour "12 compagni")
  const admin = createAdminClient()
  const { count } = await admin
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', membership.group_id)

  return NextResponse.json({ group: g ? { id: g.id, name: g.name, members: count ?? 1 } : null })
}

// POST /api/game/groups — body: { code } → entra nel gruppo (uno solo per giocatore)
export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { code } = await request.json().catch(() => ({}))
  if (!code?.trim()) return NextResponse.json({ error: 'code richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { data: group } = await admin
    .from('groups')
    .select('id, name')
    .ilike('code', code.trim())
    .maybeSingle()
  if (!group) return NextResponse.json({ error: 'Codice gruppo non valido' }, { status: 404 })

  // Un solo gruppo per giocatore: lascia gli altri prima di entrare.
  await supabase.from('group_members').delete().eq('user_id', user.id)
  const { error } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, name: group.name })
}

// DELETE /api/game/groups → esci dal gruppo
export async function DELETE() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  await supabase.from('group_members').delete().eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
