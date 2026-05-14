import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildMock({ insertReturn = { id: 'sess-1' } as any, insertError = null as any } = {}) {
  return {
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: insertReturn, error: insertError })),
        })),
      })),
    })),
  }
}

function makeReq(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
}

describe('Admin /api/admin/session/create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(makeReq({ name: 'T' }))).status).toBe(401)
  })

  it('403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await POST(makeReq({ name: 'T' }))).status).toBe(403)
  })

  it('200 returns sessionId on success', async () => {
    const res = await POST(makeReq({ name: 'Sagra', durationMinutes: 60 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionId).toBe('sess-1')
  })

  it('500 on DB error', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({
      insertError: { message: 'db down' },
    }) as any)
    const res = await POST(makeReq({ name: 'T' }))
    expect(res.status).toBe(500)
  })
})
