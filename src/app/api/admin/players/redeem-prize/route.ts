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

// POST /api/admin/players/redeem-prize
// body: { prizeId }  (player_prizes.id)  OR  { code }
// Marks a won special-prize voucher as redeemed. Idempotent-safe: a second
// redeem returns 409.
export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })

  const { prizeId, code } = await request.json().catch(() => ({}))
  if (!prizeId && !code) {
    return NextResponse.json({ error: 'prizeId o code richiesto' }, { status: 400 })
  }

  const admin = createAdminClient()

  let query = admin.from('player_prizes').select('id, redeemed_at, prize:special_prizes(name)')
  query = prizeId ? query.eq('id', prizeId) : query.eq('code', code)
  const { data: voucher } = await query.maybeSingle()

  if (!voucher) return NextResponse.json({ error: 'Voucher non trovato' }, { status: 404 })
  if (voucher.redeemed_at) {
    return NextResponse.json({ error: 'Voucher già riscattato', alreadyRedeemed: true }, { status: 409 })
  }

  const { error } = await admin
    .from('player_prizes')
    .update({ redeemed_at: new Date().toISOString(), redeemed_by_admin_id: auth.user.id })
    .eq('id', voucher.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, prizeName: (voucher.prize as any)?.name ?? null })
}
