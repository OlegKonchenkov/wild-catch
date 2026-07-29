/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase query-builder
   mocks are self-referential chains; typing them adds noise without catching
   anything the assertions don't already cover. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitResponse: vi.fn(),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { FLEE_COOLDOWN_SECONDS } from '@/lib/game/step-counter'

const mockGetUser = vi.fn()

/**
 * `fledRow` is what the encounters UPDATE ... RETURNING resolves to: a row when
 * an active encounter was actually closed, null when there was nothing to close
 * (double tap, already resolved, someone else's encounter).
 */
function buildMock(fledRow: { session_id: string } | null = { session_id: 'sess-1' }) {
  const psUpdates: Array<Record<string, unknown>> = []

  const encountersChain = () => {
    const chain: any = {}
    chain.update = () => chain
    chain.eq = () => chain
    chain.select = () => chain
    chain.maybeSingle = async () => ({ data: fledRow })
    return chain
  }

  const playerSessionsChain = () => {
    const chain: any = {}
    chain.update = (payload: Record<string, unknown>) => { psUpdates.push(payload); return chain }
    chain.eq = () => chain
    chain.then = (resolve: (v: { error: null }) => unknown) => resolve({ error: null })
    return chain
  }

  return {
    client: {
      auth: { getUser: mockGetUser },
      from: vi.fn((table: string) =>
        table === 'encounters' ? encountersChain() : playerSessionsChain()),
    },
    psUpdates,
  }
}

describe('POST /api/game/encounter/flee', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock().client as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when encounterId is missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('200 and ok:true on valid flee', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  // Fleeing used to be completely free, which made it the optimal reroll:
  // creature HP resets every encounter, so bailing out cost nothing and was the
  // fastest way to farm for rare spawns.
  it('applies the encounter cooldown when an encounter was actually closed', async () => {
    const { client, psUpdates } = buildMock({ session_id: 'sess-1' })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const before = Date.now()
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    const body = await res.json()

    expect(body.cooldownSeconds).toBe(FLEE_COOLDOWN_SECONDS)
    expect(psUpdates).toHaveLength(1)
    const until = Date.parse(psUpdates[0].encounter_block_until as string)
    expect(until).toBeGreaterThanOrEqual(before + FLEE_COOLDOWN_SECONDS * 1000)
    expect(body.blockedUntil).toBe(psUpdates[0].encounter_block_until)
  })

  // Otherwise a second tap on an already-resolved encounter would keep pushing
  // the player's own cooldown further out.
  it('does not extend the cooldown when nothing was closed', async () => {
    const { client, psUpdates } = buildMock(null)
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.blockedUntil).toBeNull()
    expect(body.cooldownSeconds).toBe(0)
    expect(psUpdates).toHaveLength(0)
  })
})
