import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, POST, DELETE, PATCH } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabaseMock() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdminMock({ existing = [] as any[] } = {}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(async () => ({ data: existing })),
          // For "fetch existing codes" call (no .order chain)
          then: undefined,
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(async () => ({ data: existing.length ? existing : [{ id: 'inv-1' }], error: null })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
  }
}

// More precise admin mock for codes/insert flow
function buildAdminMockFull({ existingCodes = [] as Array<{ code: string }>, insertReturn = [{ id: 'inv-1' }] } = {}) {
  return {
    from: vi.fn(() => {
      const baseSelect = () => ({
        eq: vi.fn(() => ({
          // Either .order() (for GET) or just await (for existing-codes fetch in POST)
          order: vi.fn(async () => ({ data: existingCodes })),
          then: (resolve: any) => resolve({ data: existingCodes }),
        })),
      })
      return {
        select: vi.fn(baseSelect),
        insert: vi.fn(() => ({
          select: vi.fn(async () => ({ data: insertReturn, error: null })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
    }),
  }
}

describe('Admin /api/admin/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMockFull() as any)
  })

  it('POST 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: 's', quantity: 1 }) }))
    expect(res.status).toBe(401)
  })

  it('POST 403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: 's', quantity: 1 }) }))
    expect(res.status).toBe(403)
  })

  it('POST 400 when quantity invalid', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: 's', quantity: 0 }) }))
    expect(res.status).toBe(400)
  })

  it('POST 400 when quantity > 500', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: 's', quantity: 1000 }) }))
    expect(res.status).toBe(400)
  })

  it('POST 200 generates codes for valid request', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: 's', quantity: 3 }) }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.codes).toHaveLength(3)
    // All codes should be 8 uppercase chars from the safe alphabet
    body.codes.forEach((c: string) => expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/))
  })

  it('GET 400 when sessionId missing', async () => {
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(400)
  })

  it('GET 200 returns invites list', async () => {
    const res = await GET(new Request('http://x?sessionId=sess-1'))
    expect(res.status).toBe(200)
  })

  it('DELETE 400 when inviteId missing', async () => {
    const res = await DELETE(new Request('http://x', { method: 'DELETE', body: JSON.stringify({}) }))
    expect(res.status).toBe(400)
  })

  it('DELETE 200 revokes invite', async () => {
    const res = await DELETE(new Request('http://x', { method: 'DELETE', body: JSON.stringify({ inviteId: 'inv-1' }) }))
    expect(res.status).toBe(200)
  })

  it('PATCH 200 resets used invite', async () => {
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ inviteId: 'inv-1' }) }))
    expect(res.status).toBe(200)
  })
})
