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

function buildAdminMock() {
  const channelMock = {
    subscribe: vi.fn((cb: () => void) => { cb(); return channelMock }),
    send: vi.fn(async () => {}),
  }
  return {
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { name: 'Test Session' } })),
          })),
        })),
      }
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [] })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        })),
      }
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ count: 2 })),
          })),
        })),
      }
      if (table === 'hall_of_fame') return {
        insert: vi.fn(async () => ({ error: null })),
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(async () => {}),
  }
}

describe('POST /api/admin/session/close', () => {
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
      body: JSON.stringify({ sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('403 when user is not admin', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock(false) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(403)
  })

  it('200 closed:true — session is updated and channel broadcast fires', async () => {
    const admin = buildAdminMock()
    vi.mocked(createAdminClient).mockReturnValue(admin as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.closed).toBe(true)
    expect(admin.channel).toHaveBeenCalledWith('session:sess-1')
    expect(admin.removeChannel).toHaveBeenCalled()
  })

  it('200 closed:true even when player list is empty', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-empty' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.closed).toBe(true)
  })
})
