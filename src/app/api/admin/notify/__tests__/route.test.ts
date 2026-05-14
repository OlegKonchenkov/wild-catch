import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabaseMock() {
  return {
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    channel: vi.fn(() => ({
      subscribe: (cb: any) => { cb(); return { unsubscribe: () => undefined } },
      send: vi.fn(async () => ({ status: 'ok' })),
    })),
    removeChannel: vi.fn(),
  }
}

function buildAdminMock({ playerSessions = [] as any[] } = {}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: playerSessions[0] ?? null })),
            })),
          })),
        })),
      })),
      insert: vi.fn(async () => ({ error: null })),
    })),
    channel: vi.fn(() => ({
      subscribe: (cb: any) => { cb(); return { unsubscribe: () => undefined } },
      send: vi.fn(async () => ({ status: 'ok' })),
    })),
    removeChannel: vi.fn(),
  }
}

function makeReq(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
}

describe('Admin /api/admin/notify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeReq({ title: 'T', message: 'M', sessionId: 's' }))
    expect(res.status).toBe(401)
  })

  it('403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const res = await POST(makeReq({ title: 'T', message: 'M', sessionId: 's' }))
    expect(res.status).toBe(403)
  })

  it('400 when title missing', async () => {
    const res = await POST(makeReq({ message: 'M', sessionId: 's' }))
    expect(res.status).toBe(400)
  })

  it('400 when neither sessionId nor userId', async () => {
    const res = await POST(makeReq({ title: 'T', message: 'M' }))
    expect(res.status).toBe(400)
  })

  it('200 for session-wide broadcast', async () => {
    const res = await POST(makeReq({ title: 'T', message: 'M', sessionId: 's' }))
    expect(res.status).toBe(200)
  })

  it('200 for single-user notification', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
      playerSessions: [{ session_id: 's' }],
    }) as any)
    const res = await POST(makeReq({ title: 'T', message: 'M', userId: 'user-1' }))
    expect(res.status).toBe(200)
  })

  it('accepts `body` field as alias for message (backward compat)', async () => {
    const res = await POST(makeReq({ title: 'T', body: 'B', sessionId: 's' }))
    expect(res.status).toBe(200)
  })
})
