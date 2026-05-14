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

function buildAdmin({ enigmi = [{ id: 'e-1', title: 'Test', frammenti: [], suggerimenti: [] }] } = {}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: enigmi, error: null })),
          is: vi.fn(async () => ({ data: enigmi, error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 'e-new' }, error: null })),
        })),
      })),
    })),
  }
}

describe('Admin /api/admin/enigmi', () => {
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

  it('GET 200 returns enigmi for session', async () => {
    const res = await GET(new Request('http://x?sessionId=s'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enigmi).toHaveLength(1)
  })

  it('GET sessionId=global filters by session_id IS NULL', async () => {
    const res = await GET(new Request('http://x?sessionId=global'))
    expect(res.status).toBe(200)
  })

  it('POST 401 not authed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: 'T', solution: 'X' }) }))
    expect(res.status).toBe(401)
  })

  it('POST 403 not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: 'T', solution: 'X' }) }))
    expect(res.status).toBe(403)
  })
})
