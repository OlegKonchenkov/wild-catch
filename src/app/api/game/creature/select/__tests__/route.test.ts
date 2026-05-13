import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { PUT } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

function buildMock(pcExists = true) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: pcExists ? { id: 'pc-1' } : null })),
          })) })) })),
        })),
      }
      if (table === 'player_sessions') return {
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        })),
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('PUT /api/game/creature/select', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PUT(new Request('http://x', {
      method: 'PUT',
      body: JSON.stringify({ playerCreatureId: 'pc-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('404 when creature does not belong to the user', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock(false) as any)
    const res = await PUT(new Request('http://x', {
      method: 'PUT',
      body: JSON.stringify({ playerCreatureId: 'pc-missing', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(404)
  })

  it('200 success:true on valid selection', async () => {
    const res = await PUT(new Request('http://x', {
      method: 'PUT',
      body: JSON.stringify({ playerCreatureId: 'pc-1', sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
