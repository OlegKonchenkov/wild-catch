import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, PUT } from '../route'
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
          maybeSingle: vi.fn(async () => ({ data: { session_id: 's', non_comune_bonus: 0 }, error: null })),
          single: vi.fn(async () => ({ data: { session_id: 's' }, error: null })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { session_id: 's' }, error: null })),
        })),
      })),
    })),
  }
}

describe('Admin /api/admin/spawn-config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('GET 401', async () => {
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
    expect((await GET(new Request('http://x?sessionId=s'))).status).toBe(200)
  })

  it('PUT 200', async () => {
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ sessionId: 's', non_comune_bonus: 0.1 }) }))
    expect(res.status).toBe(200)
  })
})
