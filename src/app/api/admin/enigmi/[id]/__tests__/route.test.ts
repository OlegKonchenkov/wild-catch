import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, PATCH, DELETE } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabase() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdmin({ enigma = { id: 'e-1', title: 'Test', frammenti: [], suggerimenti: [] } as any } = {}) {
  // PATCH runs multiple sub-queries (delete + insert frammenti, etc).
  // Use a recursive chain so any sequence of methods terminates safely.
  const makeChain = (): any => {
    const chain: any = {
      single: vi.fn(async () => ({ data: enigma, error: null })),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      select: vi.fn(() => chain),
      then: (resolve: any) => resolve({ data: [], error: null }),
    }
    return chain
  }
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => makeChain()),
      update: vi.fn(() => makeChain()),
      delete: vi.fn(() => makeChain()),
      insert: vi.fn(() => makeChain()),
    })),
  }
}

const ctx = { params: Promise.resolve({ id: 'e-1' }) }

describe('Admin /api/admin/enigmi/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('GET 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET(new Request('http://x'), ctx)).status).toBe(401)
  })

  it('GET 403 not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await GET(new Request('http://x'), ctx)).status).toBe(403)
  })

  it('GET 200', async () => {
    expect((await GET(new Request('http://x'), ctx)).status).toBe(200)
  })

  it('PATCH 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({}) }), ctx)).status).toBe(401)
  })

  it('PATCH 200', async () => {
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ title: 'Updated' }) }), ctx)
    expect(res.status).toBe(200)
  })

  it('DELETE 200', async () => {
    expect((await DELETE(new Request('http://x', { method: 'DELETE' }), ctx)).status).toBe(200)
  })
})
