import { beforeEach, describe, expect, it, vi } from 'vitest'

// Captures the query builder calls so we can assert on the filters applied.
const calls: Array<{ table: string; or?: string; eq: Array<[string, unknown]> }> = []

function builder(table: string) {
  const record: { table: string; or?: string; eq: Array<[string, unknown]> } = { table, eq: [] }
  calls.push(record)
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = self
  chain.order = self
  chain.eq = (col: string, val: unknown) => { record.eq.push([col, val]); return chain }
  chain.or = (filter: string) => { record.or = filter; return chain }
  // Awaiting the builder resolves like a PostgREST response.
  chain.then = (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: [] })
  return chain
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn((table: string) => builder(table)) })),
}))

import { getSpawnableCreatures, getStarterCreatures, invalidateConfigCache } from '@/lib/game/config-cache'

const SESSION_A = '11111111-1111-1111-1111-111111111111'
const SESSION_B = '22222222-2222-2222-2222-222222222222'

describe('creature config cache — session scoping', () => {
  beforeEach(() => {
    calls.length = 0
    invalidateConfigCache('all')
  })

  // The spawn pool used to fetch the whole `spawnable` catalogue with no
  // session filter, so creatures authored as exclusive to one event spawned at
  // every other event too.
  it('scopes the spawn pool to the session plus the global catalogue', async () => {
    await getSpawnableCreatures(SESSION_A)
    expect(calls).toHaveLength(1)
    expect(calls[0].table).toBe('creatures')
    expect(calls[0].or).toBe(`session_id.eq.${SESSION_A},session_id.is.null`)
    expect(calls[0].eq).toContainEqual(['spawnable', true])
  })

  it('scopes the starter pool the same way', async () => {
    await getStarterCreatures(SESSION_A)
    expect(calls[0].or).toBe(`session_id.eq.${SESSION_A},session_id.is.null`)
    expect(calls[0].eq).toContainEqual(['rarity', 'comune'])
  })

  // The cache key used to be a single global string, so even with the filter in
  // place the first session to warm the cache would serve its pool to everyone.
  it('caches per session, not globally', async () => {
    await getSpawnableCreatures(SESSION_A)
    await getSpawnableCreatures(SESSION_A) // served from cache
    expect(calls).toHaveLength(1)

    await getSpawnableCreatures(SESSION_B) // different session → must re-query
    expect(calls).toHaveLength(2)
    expect(calls[1].or).toBe(`session_id.eq.${SESSION_B},session_id.is.null`)
  })

  it('invalidateConfigCache("creatures") clears every session entry', async () => {
    await getSpawnableCreatures(SESSION_A)
    await getSpawnableCreatures(SESSION_B)
    expect(calls).toHaveLength(2)

    invalidateConfigCache('creatures')

    await getSpawnableCreatures(SESSION_A)
    await getSpawnableCreatures(SESSION_B)
    expect(calls).toHaveLength(4)
  })
})
