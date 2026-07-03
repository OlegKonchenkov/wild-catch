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

/** Codice join leggibile: 6 caratteri senza ambigui (0/O, 1/I). */
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

// GET /api/admin/groups → gruppi + conteggio membri
export async function GET() {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const admin = createAdminClient()
  const [{ data: groups }, { data: members }] = await Promise.all([
    admin.from('groups').select('id, name, code, created_at').order('created_at', { ascending: false }),
    admin.from('group_members').select('group_id'),
  ])
  const countByGroup = new Map<string, number>()
  for (const m of members ?? []) countByGroup.set(m.group_id, (countByGroup.get(m.group_id) ?? 0) + 1)

  return NextResponse.json({
    groups: (groups ?? []).map(g => ({ ...g, members: countByGroup.get(g.id) ?? 0 })),
  })
}

// POST /api/admin/groups — body: { name } → crea gruppo con codice generato
export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { name } = await request.json().catch(() => ({}))
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })

  const admin = createAdminClient()
  // Ritenta sulle rarissime collisioni di codice
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { data, error } = await admin
      .from('groups')
      .insert({ name: name.trim(), code, created_by: auth.user.id })
      .select('id, name, code')
      .single()
    if (!error) return NextResponse.json({ group: data })
    if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: 'Generazione codice fallita, riprova' }, { status: 500 })
}

// DELETE /api/admin/groups?id=...
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })
  const { error } = await createAdminClient().from('groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
