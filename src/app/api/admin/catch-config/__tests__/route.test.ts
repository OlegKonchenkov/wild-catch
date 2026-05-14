import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, PUT } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabaseMock() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdminMock({ existing = { id: 1, comune_rate: 0.7 } as any } = {}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: existing })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 1, comune_rate: 0.8 }, error: null })),
        })),
      })),
    })),
  }
}

describe('Admin /api/admin/catch-config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('GET 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET(new Request('http://x'))).status).toBe(401)
  })

  it('GET 403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await GET(new Request('http://x'))).status).toBe(403)
  })

  it('GET returns existing config', async () => {
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config.comune_rate).toBe(0.7)
  })

  it('GET returns defaults when no row exists', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({ existing: null }) as any)
    const res = await GET(new Request('http://x'))
    const body = await res.json()
    expect(body.config.id).toBe(1)
    expect(body.config.comune_rate).toBe(0.70)
  })

  it('PUT 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({}) }))
    expect(res.status).toBe(401)
  })

  it('PUT 403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('PUT 200 on valid update', async () => {
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ comune_rate: 0.8 }) }))
    expect(res.status).toBe(200)
  })
})
