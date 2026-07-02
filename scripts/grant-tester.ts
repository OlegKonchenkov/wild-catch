/**
 * One-off: give the test account a kit to exercise the new loot/collection
 * features. Grants gemme, every seeded bustina, some ability tokens, all keys,
 * and one of each chest — to every session the user belongs to (active first).
 *
 * Run:
 *   export NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
 *   npx tsx scripts/grant-tester.ts konchenkovoleg@gmail.com
 */
import { createClient } from '@supabase/supabase-js'

const EMAIL = process.argv[2] ?? 'konchenkovoleg@gmail.com'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), { auth: { persistSession: false } })

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find(u => (u.email ?? '').toLowerCase() === email.toLowerCase())
    if (u) return u.id
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  const userId = await findUserId(EMAIL)
  if (!userId) { console.error(`User ${EMAIL} not found`); process.exit(1) }
  console.log(`user ${EMAIL} = ${userId}`)

  // Sessions the user belongs to, joined to status. Prefer active ones.
  const { data: pss } = await db.from('player_sessions')
    .select('session_id, gemme, sessions(status, name)')
    .eq('user_id', userId)
  const rows = (pss ?? []) as any[]
  if (rows.length === 0) { console.error('User is not in any session'); process.exit(1) }
  const active = rows.filter(r => r.sessions?.status === 'active')
  const targets = active.length > 0 ? active : rows
  console.log(`granting to ${targets.length} session(s)${active.length ? ' (active)' : ' (all — none active)'}`)

  const { data: packs } = await db.from('packs').select('id, name')
  const { data: chests } = await db.from('chests').select('id, name')
  const { data: keys } = await db.from('items').select('id, name').eq('type', 'chiave')
  const { data: abilities } = await db.from('abilities').select('id, name').order('created_at').limit(4)

  for (const t of targets) {
    const sid = t.session_id

    // Gemme: ensure at least 800
    const target = Math.max(t.gemme ?? 0, 800)
    await db.from('player_sessions').update({ gemme: target }).eq('user_id', userId).eq('session_id', sid)

    // Bustine: 3 of each pack
    for (const p of packs ?? []) {
      await db.from('player_packs').upsert(
        { user_id: userId, session_id: sid, pack_id: p.id, quantity: 3 },
        { onConflict: 'user_id,session_id,pack_id' })
    }
    // Keys: 3 of each
    for (const k of keys ?? []) {
      await db.from('player_inventory').upsert(
        { user_id: userId, session_id: sid, item_id: k.id, quantity: 3 },
        { onConflict: 'user_id,session_id,item_id' })
    }
    // Chests: 1 of each
    for (const c of chests ?? []) {
      await db.from('player_chests').upsert(
        { user_id: userId, session_id: sid, chest_id: c.id, quantity: 1 },
        { onConflict: 'user_id,session_id,chest_id' })
    }
    // Abilities: 2 tokens of each of up to 4 abilities
    for (const a of abilities ?? []) {
      await db.from('player_abilities').upsert(
        { user_id: userId, session_id: sid, ability_id: a.id, quantity: 2 },
        { onConflict: 'user_id,session_id,ability_id' })
    }
    console.log(`  ✓ session ${t.sessions?.name ?? sid}: gemme=${target}, ${packs?.length ?? 0} packs×3, ${keys?.length ?? 0} keys×3, ${chests?.length ?? 0} chests×1, ${abilities?.length ?? 0} abilities×2`)
  }
  console.log('Done.')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
