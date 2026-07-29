import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { LEGAL, RETENTION_MONTHS } from '@/lib/legal/controller'
import type { Database } from '@/types/database'

/**
 * GET /api/profile/export — GDPR art. 20 (data portability).
 *
 * Returns everything we hold about the caller as one JSON document, in a
 * structured, commonly used, machine-readable format. There was no way to get
 * one's data out before this: erasure existed (badly — see migration 082) but
 * portability did not.
 *
 * Uses the admin client on purpose: RLS would silently drop rows the user is
 * entitled to receive but not to SELECT directly (e.g. rows written on their
 * behalf by server routes). Every query below is filtered by the caller's own
 * id, so the elevated client can only ever read the requester's own data.
 */

type Tables = Database['public']['Tables']

/**
 * Every table that has a `user_id` column, derived from the generated types.
 * Naming a table that doesn't own one — or misspelling it — is a compile error
 * rather than a silently missing section of somebody's export.
 */
type UserOwnedTable = {
  [K in keyof Tables]: 'user_id' extends keyof Tables[K]['Row'] ? K : never
}[keyof Tables]

const OWNED_TABLES: readonly UserOwnedTable[] = [
  'player_sessions',
  'player_creatures',
  'player_inventory',
  'player_missions',
  'player_abilities',
  'player_eggs',
  'creature_abilities',
  'creature_equipment',
  'player_packs',
  'player_chests',
  'player_prizes',
  'player_collection',
  'player_trophies',
  'player_quizzes',
  'player_pergamene',
  'player_place_unlocks',
  'player_daily_claims',
  'player_enigmi',
  'player_enigma_frammenti',
  'player_enigma_suggerimenti',
  'player_notifications',
  'player_game_events',
  'player_level_rewards',
  'encounters',
  'boss_fights',
  'group_members',
  'push_subscriptions',
  'hall_of_fame',
] as const

/**
 * Tables where the player can appear under more than one column.
 *
 * Narrowed to these four literals rather than `keyof Tables`: PostgREST's `.or()`
 * builder resolved over a 60-table union blows past TypeScript's instantiation
 * depth limit.
 */
type MultiColumnTable = 'duels' | 'friendships' | 'trades' | 'gym_holds'

const MULTI_COLUMN_TABLES: ReadonlyArray<{ table: MultiColumnTable; columns: string[] }> = [
  { table: 'duels', columns: ['challenger_id', 'opponent_id', 'winner_id'] },
  { table: 'friendships', columns: ['requester_id', 'addressee_id'] },
  { table: 'trades', columns: ['proposer_id', 'recipient_id'] },
  { table: 'gym_holds', columns: ['holder_id'] },
]

export async function GET() {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // The export fans out across ~30 tables; a couple per hour per user is plenty.
  const rl = await rateLimit('profile_export', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const admin = createAdminClient()
  const data: Record<string, unknown> = {}

  // getAuthUser() decodes the JWT and so has no sign-up / last-login metadata;
  // both belong in a portability export, so read the full record.
  const [{ data: profile }, { data: authRes }] = await Promise.all([
    admin.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    admin.auth.admin.getUserById(user.id),
  ])
  const authUser = authRes?.user ?? null

  await Promise.all([
    ...OWNED_TABLES.map(async table => {
      const { data: rows, error } = await admin.from(table).select('*').eq('user_id', user.id)
      // A table that doesn't exist in this deployment shouldn't sink the export.
      if (!error) data[table] = rows ?? []
    }),
    ...MULTI_COLUMN_TABLES.map(async ({ table, columns }) => {
      const filter = columns.map(c => `${c}.eq.${user.id}`).join(',')
      const { data: rows, error } = await admin.from(table).select('*').or(filter)
      if (!error) data[table] = rows ?? []
    }),
  ])

  const payload = {
    _meta: {
      generatedAt: new Date().toISOString(),
      app: LEGAL.appName,
      controller: LEGAL.businessName,
      contact: LEGAL.email,
      about:
        "Questo file contiene i dati personali associati al tuo account, esportati su tua richiesta (art. 20 GDPR). " +
        `I dati di gioco vengono comunque cancellati automaticamente ${RETENTION_MONTHS} mesi dopo la chiusura di ogni evento.`,
      format: 'JSON — una chiave per tabella, ciascuna con le righe che ti riguardano',
    },
    account: {
      id: user.id,
      email: authUser?.email ?? user.email ?? null,
      createdAt: authUser?.created_at ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      provider: authUser?.app_metadata?.provider ?? null,
    },
    profile: profile ?? null,
    ...data,
  }

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="daimon-dati-${stamp}.json"`,
      // Never let a CDN or the browser keep a copy of someone's personal data.
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
