/* eslint-disable @typescript-eslint/no-explicit-any -- self-referential Supabase
   query-builder mock; typing the chain adds noise without catching anything. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetAuthUser = vi.fn()
const mockRateLimit = vi.fn()
const queried: Array<{ table: string; eq?: [string, unknown]; or?: string }> = []

vi.mock('@/lib/supabase/auth-fast', () => ({ getAuthUser: () => mockGetAuthUser() }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => mockRateLimit(),
  rateLimitResponse: () => new Response(null, { status: 429 }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: 'p@example.com', created_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'google' } } },
        }),
      },
    },
    from: (table: string) => {
      const record: { table: string; eq?: [string, unknown]; or?: string } = { table }
      const chain: any = {}
      chain.select = () => chain
      chain.eq = (col: string, val: unknown) => { record.eq = [col, val]; queried.push(record); return chain }
      chain.or = (filter: string) => { record.or = filter; queried.push(record); return chain }
      chain.maybeSingle = async () => ({ data: { nickname: 'Marco' } })
      chain.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: [{ id: 'row-1' }], error: null })
      return chain
    },
  }),
}))

import { GET } from '../route'

/**
 * GDPR art. 20 — data portability. Before this endpoint there was no way to
 * obtain a copy of one's own data at all.
 */
describe('GET /api/profile/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queried.length = 0
    mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1', email: 'p@example.com' } })
    mockRateLimit.mockResolvedValue({ success: true })
  })

  it('401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue({ user: null })
    expect((await GET()).status).toBe(401)
  })

  it('429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ success: false, reset: 1 })
    expect((await GET()).status).toBe(429)
  })

  it('returns a downloadable JSON attachment', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="daimon-dati-\d{4}-\d{2}-\d{2}\.json"/)
  })

  // Someone's whole personal dataset must not sit in a CDN or disk cache.
  it('forbids caching the response', () => {
    return GET().then(res => expect(res.headers.get('Cache-Control')).toContain('no-store'))
  })

  it('includes the account, the profile and the game tables', async () => {
    const body = await (await GET()).json()
    expect(body.account).toMatchObject({ id: 'user-1', provider: 'google' })
    expect(body.profile).toEqual({ nickname: 'Marco' })
    expect(body.player_sessions).toEqual([{ id: 'row-1' }])
    expect(body.player_creatures).toEqual([{ id: 'row-1' }])
    expect(body._meta.generatedAt).toBeTruthy()
  })

  // The export runs on the service-role client to bypass RLS, so the ONLY thing
  // keeping it from leaking other people's rows is that every query is filtered
  // by the caller's id. That invariant is worth a test of its own.
  it('scopes every single query to the caller', async () => {
    await GET()
    expect(queried.length).toBeGreaterThan(20)
    for (const q of queried) {
      const scoped = q.eq?.[1] === 'user-1' || q.or?.includes('user-1')
      expect(scoped, `${q.table} was not scoped to the caller`).toBe(true)
    }
  })

  it('matches the player on every relevant column for multi-party tables', async () => {
    await GET()
    const duels = queried.find(q => q.table === 'duels')
    expect(duels?.or).toBe('challenger_id.eq.user-1,opponent_id.eq.user-1,winner_id.eq.user-1')
  })
})
