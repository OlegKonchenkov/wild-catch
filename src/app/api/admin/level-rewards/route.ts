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

// GET /api/admin/level-rewards
export async function GET() {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('level_rewards')
    .select('*, items(id, name, type)')
    .order('level')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rewards: data ?? [] })
}

// PUT /api/admin/level-rewards — upsert a level reward
export async function PUT(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const body = await request.json().catch(() => ({}))
  const { level, gold, item_id, item_qty, description, bonus_items } = body

  if (!level || level < 1) return NextResponse.json({ error: 'Livello non valido' }, { status: 400 })

  // bonus_items is the source of truth; item_id/item_qty kept for backward compat
  const effectiveBonus: { item_id: string; quantity: number }[] = Array.isArray(bonus_items)
    ? bonus_items.filter((bi: any) => bi.item_id)
    : (item_id ? [{ item_id, quantity: Number(item_qty) || 1 }] : [])

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('level_rewards')
    .upsert({
      level: Number(level),
      gold: Number(gold) || 0,
      item_id: effectiveBonus[0]?.item_id ?? null,
      item_qty: effectiveBonus[0]?.quantity ?? 1,
      bonus_items: effectiveBonus,
      description: description?.trim() ?? '',
    }, { onConflict: 'level' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reward: data })
}
