import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET, PATCH } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

function buildMock({ ownedIds = ['pc-1', 'pc-2'] } = {}) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { squad_ids: ['pc-1'] } })),
          })) })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        })),
      }
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            in: vi.fn(async () => ({ data: ownedIds.map(id => ({ id })) })),
          })) })),
        })),
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('GET /api/game/squad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(new Request('http://x?sessionId=sess-1'))
    expect(res.status).toBe(401)
  })

  it('400 when sessionId is missing', async () => {
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(400)
  })

  it('200 returns squadIds', async () => {
    const res = await GET(new Request('http://x?sessionId=sess-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.squadIds)).toBe(true)
  })
})

describe('PATCH /api/game/squad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PATCH(new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId: 'sess-1', squadIds: ['pc-1'] }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when squadIds exceeds 3', async () => {
    const res = await PATCH(new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId: 'sess-1', squadIds: ['a', 'b', 'c', 'd'] }),
    }))
    expect(res.status).toBe(400)
  })

  it('400 when creatures do not all belong to the user', async () => {
    // Only pc-1 returned, but requesting pc-1 + pc-missing
    vi.mocked(createClient).mockResolvedValue(buildMock({ ownedIds: ['pc-1'] }) as any)
    const res = await PATCH(new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId: 'sess-1', squadIds: ['pc-1', 'pc-missing'] }),
    }))
    expect(res.status).toBe(400)
  })

  it('200 ok:true on valid squad update', async () => {
    const res = await PATCH(new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId: 'sess-1', squadIds: ['pc-1', 'pc-2'] }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
