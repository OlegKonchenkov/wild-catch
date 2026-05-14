import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()

const PC = { id: 'pc-1', creature_id: 'cr-1', duplicates_count: 3, evolved: false }
const EVOLVED_FORM = { id: 'cr-2', name: 'Fiammare+', rarity: 'raro', element: 'fiamma', image_url: null, sprite_url: null, hp: 120, atk: 40, def: 20, description: null }

function buildSupabaseMock(pcOverride = PC) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: pcOverride })),
          })) })) })),
        })),
      }
      if (table === 'creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: EVOLVED_FORM })) })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

function buildAdminMock() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null })),
        })) })) })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      upsert: vi.fn(async () => ({ error: null })),
    })),
  }
}

describe('POST /api/game/creature/evolve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ playerCreatureId: 'pc-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when creature has fewer than 3 duplicates', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock({
      ...PC, duplicates_count: 2,
    }) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ playerCreatureId: 'pc-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('3')
  })

  it('404 when no evolution form exists', async () => {
    const supabaseMock = buildSupabaseMock()
    ;(supabaseMock.from as any).mockImplementation((table: string) => {
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: PC })),
          })) })) })),
        })),
      }
      if (table === 'creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    })
    vi.mocked(createClient).mockResolvedValue(supabaseMock as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ playerCreatureId: 'pc-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(404)
  })

  it('200 evolved:true with new creature on success', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ playerCreatureId: 'pc-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.evolved).toBe(true)
    expect(body.copiesConsumed).toBe(2)
    expect(body.newCreature.id).toBe('cr-2')
  })

  it('200 — re-evolves even when evolved flag is already true (stockpile rule)', async () => {
    // Design rule "every 3 copies = +1 evolution": the player can keep
    // grinding more base creatures and call /evolve again. The `evolved`
    // boolean is informational, not a gate.
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock({
      ...PC, duplicates_count: 3, evolved: true,
    }) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ playerCreatureId: 'pc-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.evolved).toBe(true)
    expect(body.copiesConsumed).toBe(2)
  })
})
