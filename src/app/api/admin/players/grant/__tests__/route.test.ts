import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()

function buildSupabaseMock(isAdmin = true) {
  return {
    auth: { getUser: mockGetUser },
    rpc: vi.fn(async () => ({ data: isAdmin })),
  }
}

function buildAdminMock({ sessionActive = true, playerGold = 100 } = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: sessionActive ? { status: 'active' } : { status: 'ended' },
            })),
          })),
        })),
      }
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { gold: playerGold } })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        })),
      }
      if (table === 'player_inventory') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null })),
              })),
            })),
          })),
        })),
        insert: vi.fn(async () => ({ error: null })),
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('POST /api/admin/players/grant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock(true) as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ userId: 'u-1', sessionId: 'sess-1', type: 'gold', amount: 50 }),
    }))
    expect(res.status).toBe(401)
  })

  it('403 when user is not admin', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock(false) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ userId: 'u-1', sessionId: 'sess-1', type: 'gold', amount: 50 }),
    }))
    expect(res.status).toBe(403)
  })

  it('400 when required fields are missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', type: 'gold', amount: 50 }),
    }))
    expect(res.status).toBe(400)
  })

  it('200 granted:true with newValue when type is gold', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ userId: 'u-1', sessionId: 'sess-1', type: 'gold', amount: 50 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.granted).toBe(true)
    expect(body.type).toBe('gold')
    expect(body.newValue).toBe(150)
  })
})
