import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, POST } from '../route'
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
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(async () => ({ data: [{ id: 'p-1' }], error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 'p-new' }, error: null })),
        })),
      })),
    })),
  }
}

describe('Admin /api/admin/session-pins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('GET 401 not authed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET(new Request('http://x?sessionId=s'))).status).toBe(401)
  })

  it('GET 403 not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await GET(new Request('http://x?sessionId=s'))).status).toBe(403)
  })

  it('GET 400 sessionId missing', async () => {
    expect((await GET(new Request('http://x'))).status).toBe(400)
  })

  it('GET 200', async () => {
    const res = await GET(new Request('http://x?sessionId=s'))
    expect(res.status).toBe(200)
  })

  it('POST 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(401)
  })
})
