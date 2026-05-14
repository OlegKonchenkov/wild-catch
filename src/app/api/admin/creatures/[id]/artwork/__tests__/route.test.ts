import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabase() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdmin() {
  return {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: 'c-1', image_url: 'http://x.png' }, error: null })),
          })),
        })),
      })),
    })),
  }
}

const ctx = { params: Promise.resolve({ id: 'c-1' }) }

describe('Admin /api/admin/creatures/[id]/artwork', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('POST 401 when not authed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ imageUrl: 'http://x.png' }) }), ctx)
    expect(res.status).toBe(401)
  })

  it('POST 403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ imageUrl: 'http://x.png' }) }), ctx)
    expect(res.status).toBe(403)
  })

  it('POST 400 when imageUrl is not http(s)', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ imageUrl: 'not-a-url' }) }), ctx)
    expect(res.status).toBe(400)
  })

  it('POST 200 with valid imageUrl', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ imageUrl: 'http://x.png' }) }), ctx)
    expect(res.status).toBe(200)
  })
})
