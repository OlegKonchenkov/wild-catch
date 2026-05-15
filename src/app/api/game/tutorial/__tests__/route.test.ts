import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin',  () => ({ createAdminClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TUTORIAL_SESSION_ID, TUTORIAL_USER_SESSION_TABLES } from '@/lib/game/tutorial'

function buildSupabase(opts: { user?: { id: string } | null } = {}) {
  const user = opts.user === undefined ? { id: 'user-1' } : opts.user
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: user ? null : { message: 'auth' },
      })),
    },
  }
}

function buildAdmin(opts: {
  existingPlayerSession?: { id: string; onboarding_seen: boolean } | null
  deleteShouldError?: { table: string; message: string }
  insertShouldError?: string
} = {}) {
  const deleteCalls: Array<{ table: string }> = []
  const insertCalls: Array<{ table: string; row: Record<string, unknown> }> = []

  function chainDelete(table: string) {
    return {
      delete: vi.fn(() => ({
        // .delete().eq('user_id', …).eq('session_id', …)
        eq: vi.fn(() => ({
          eq: vi.fn(async () => {
            deleteCalls.push({ table })
            if (opts.deleteShouldError?.table === table) {
              return { error: { message: opts.deleteShouldError.message } }
            }
            return { error: null }
          }),
          // duel_lineups uses .eq('user_id', …).in('duel_id', […])
          in: vi.fn(async () => {
            deleteCalls.push({ table })
            if (opts.deleteShouldError?.table === table) {
              return { error: { message: opts.deleteShouldError.message } }
            }
            return { error: null }
          }),
        })),
        // duels uses .delete().or(…).eq('session_id', …)
        or: vi.fn(() => ({
          eq: vi.fn(async () => {
            deleteCalls.push({ table })
            return { error: null }
          }),
        })),
      })),
      // The tutorial start path also pre-grants the free enigma hint via
      // an upsert on player_enigma_suggerimenti. Stub it as a no-op so the
      // mock chain doesn't blow up on unrelated tables either.
      upsert: vi.fn(async () => ({ error: null })),
      // The reset's pre-wipe queries duels with .select(...).or(...).eq(...)
      // to collect duel ids → empty array means no special handling needed.
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [] })),
        })),
      })),
    }
  }

  function chainSelectMaybeSingle() {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: opts.existingPlayerSession ?? null })),
          })),
        })),
      })),
      insert: vi.fn(async (row: Record<string, unknown>) => {
        insertCalls.push({ table: 'player_sessions', row })
        return opts.insertShouldError
          ? { error: { message: opts.insertShouldError } }
          : { error: null }
      }),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => {
            deleteCalls.push({ table: 'player_sessions' })
            return { error: null }
          }),
        })),
      })),
    }
  }

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === 'player_sessions') return chainSelectMaybeSingle()
        return chainDelete(table)
      }),
    },
    deleteCalls,
    insertCalls,
  }
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/game/tutorial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/game/tutorial', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase({ user: null }) as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin().client as any)
    const res = await POST(makeRequest({ action: 'start' }))
    expect(res.status).toBe(401)
  })

  it('rejects unknown actions', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin().client as any)
    const res = await POST(makeRequest({ action: 'destroy' }))
    expect(res.status).toBe(400)
  })

  it('start: creates the player_session when missing and returns the fixed sessionId', async () => {
    const adm = buildAdmin({ existingPlayerSession: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(adm.client as any)

    const res = await POST(makeRequest({ action: 'start' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sessionId: TUTORIAL_SESSION_ID, action: 'start' })
    // One insert into player_sessions with the tutorial session id
    expect(adm.insertCalls).toHaveLength(1)
    expect(adm.insertCalls[0]).toEqual({
      table: 'player_sessions',
      row: expect.objectContaining({
        user_id: 'user-1',
        session_id: TUTORIAL_SESSION_ID,
        role: 'player',
      }),
    })
  })

  it('start: idempotent when player_session already exists (no insert)', async () => {
    const adm = buildAdmin({ existingPlayerSession: { id: 'ps-1', onboarding_seen: true } })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(adm.client as any)

    const res = await POST(makeRequest({ action: 'start' }))
    expect(res.status).toBe(200)
    expect(adm.insertCalls).toHaveLength(0)
  })

  it('reset: wipes every per-(user, session) table then recreates the player_session', async () => {
    const adm = buildAdmin({ existingPlayerSession: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(adm.client as any)

    const res = await POST(makeRequest({ action: 'reset' }))
    expect(res.status).toBe(200)
    // All TUTORIAL_USER_SESSION_TABLES were wiped, plus player_sessions and
    // duels themselves. `duel_lineups` is special-cased: only deleted when
    // the player has duel rows (verified separately below); here we mock 0
    // duels, so duel_lineups won't appear in the call log.
    const wiped = adm.deleteCalls.map(c => c.table)
    for (const t of TUTORIAL_USER_SESSION_TABLES) {
      if (t === 'duel_lineups') continue // see comment above
      expect(wiped).toContain(t)
    }
    expect(wiped).toContain('player_sessions')
    expect(wiped).toContain('duels')
    // Then a fresh player_session was inserted
    expect(adm.insertCalls).toHaveLength(1)
  })

  it('reset: deletes duel_lineups (by duel_id) when player has tutorial duels', async () => {
    // Override the duels SELECT to return a duel id so the special-cased
    // duel_lineups pre-wipe path executes.
    const adm = buildAdmin({ existingPlayerSession: null })
    ;(adm.client.from as any).mockImplementation((table: string) => {
      if (table === 'duels') {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [{ id: 'duel-1' }] })),
            })),
          })),
          delete: vi.fn(() => ({
            or: vi.fn(() => ({
              eq: vi.fn(async () => {
                adm.deleteCalls.push({ table: 'duels' })
                return { error: null }
              }),
            })),
          })),
        }
      }
      if (table === 'duel_lineups') {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => {
                adm.deleteCalls.push({ table: 'duel_lineups' })
                return { error: null }
              }),
            })),
          })),
        }
      }
      // Fallback for all other tables — reuse the standard chain.
      if (table === 'player_sessions') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })) })),
          insert: vi.fn(async () => ({ error: null })),
          delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => {
            adm.deleteCalls.push({ table: 'player_sessions' })
            return { error: null }
          }) })) })),
        }
      }
      return {
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => {
          adm.deleteCalls.push({ table })
          return { error: null }
        }) })) })),
        upsert: vi.fn(async () => ({ error: null })),
      }
    })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(adm.client as any)

    const res = await POST(makeRequest({ action: 'reset' }))
    expect(res.status).toBe(200)
    const wiped = adm.deleteCalls.map(c => c.table)
    expect(wiped).toContain('duel_lineups')
    expect(wiped).toContain('duels')
  })

  it('reset: surfaces a 500 with the failing table when a delete errors', async () => {
    const adm = buildAdmin({
      deleteShouldError: { table: 'player_inventory', message: 'fk violation' },
    })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(adm.client as any)

    const res = await POST(makeRequest({ action: 'reset' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('player_inventory')
    expect(body.detail).toBe('fk violation')
  })
})
