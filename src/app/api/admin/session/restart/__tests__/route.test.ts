import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('next/server', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return { ...actual, after: vi.fn() }
})

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabase() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdmin({ updateError = null as any } = {}) {
  return {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: updateError })) })),
    })),
    channel: vi.fn(() => ({
      subscribe: (cb: any) => cb(),
      send: vi.fn(async () => ({ status: 'ok' })),
    })),
    removeChannel: vi.fn(),
  }
}

function makeReq(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
}

describe('Admin /api/admin/session/restart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(makeReq({ sessionId: 's' }))).status).toBe(401)
  })

  it('403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await POST(makeReq({ sessionId: 's' }))).status).toBe(403)
  })

  it('400 when sessionId missing', async () => {
    expect((await POST(makeReq({}))).status).toBe(400)
  })

  it('200 + restarted:true on success', async () => {
    const res = await POST(makeReq({ sessionId: 'sess-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.restarted).toBe(true)
  })

  it('500 on DB error', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin({
      updateError: { message: 'db down' },
    }) as any)
    const res = await POST(makeReq({ sessionId: 'sess-1' }))
    expect(res.status).toBe(500)
  })
})
