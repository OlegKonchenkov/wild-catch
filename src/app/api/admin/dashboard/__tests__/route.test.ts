import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildMock() {
  // The handler's "summary stats" path runs several .from(t).select(...).eq(...)
  // queries with count:'exact' headers, plus one .from('sessions').single().
  // Build a mock chain supporting all variants the route hits.
  const makeChain = (): any => {
    const chain: any = {
      single: vi.fn(async () => ({ data: { status: 'active', name: 'Test', start_at: null, end_at: null, duration_minutes: 60 } })),
      maybeSingle: vi.fn(async () => ({ data: null })),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(async () => ({ data: [], count: 0 })),
      in: vi.fn(async () => ({ data: [] })),
      then: (resolve: any) => resolve({ data: [], count: 0 }),
    }
    return chain
  }
  return {
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn(() => makeChain()),
    })),
  }
}

describe('GET /api/admin/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(new Request('http://x?sessionId=sess-1'))
    expect(res.status).toBe(401)
  })

  it('403 when authenticated but not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    const res = await GET(new Request('http://x?sessionId=sess-1'))
    expect(res.status).toBe(403)
  })

  it('400 when sessionId missing', async () => {
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(400)
  })

  it('200 on valid admin request with sessionId', async () => {
    const res = await GET(new Request('http://x?sessionId=sess-1'))
    expect(res.status).toBe(200)
  })
})
