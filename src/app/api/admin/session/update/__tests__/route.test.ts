import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/server', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return { ...actual, after: vi.fn() }
})

import { PATCH } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildMock({ session = { status: 'draft', start_at: null } as any } = {}) {
  return {
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: session })),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
    channel: vi.fn(() => ({
      subscribe: (cb: any) => cb(),
      send: vi.fn(async () => ({ status: 'ok' })),
    })),
    removeChannel: vi.fn(),
  }
}

function makeReq(body: unknown) {
  return new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) })
}

describe('Admin /api/admin/session/update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await PATCH(makeReq({ sessionId: 's' }))).status).toBe(401)
  })

  it('403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await PATCH(makeReq({ sessionId: 's' }))).status).toBe(403)
  })

  it('400 when sessionId missing', async () => {
    expect((await PATCH(makeReq({}))).status).toBe(400)
  })

  it('200 + updates basic fields', async () => {
    const res = await PATCH(makeReq({ sessionId: 's', name: 'Nuovo Nome' }))
    expect(res.status).toBe(200)
  })

  it('recomputes end_at when duration changes on an active session', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock({
      session: { status: 'active', start_at: '2026-05-15T10:00:00Z' },
    }) as any)
    const res = await PATCH(makeReq({ sessionId: 's', durationMinutes: 90 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.endAt).toBeTruthy()
    // 10:00 + 90min = 11:30
    expect(body.endAt).toBe('2026-05-15T11:30:00.000Z')
  })

  it('does NOT recompute end_at when session is in draft (not active)', async () => {
    const res = await PATCH(makeReq({ sessionId: 's', durationMinutes: 90 }))
    const body = await res.json()
    expect(body.endAt).toBeNull()
  })
})
