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

function buildAdmin({ rows = [{ level: 2, gold_reward: 50 }] } = {}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(async () => ({ data: rows, error: null })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { level: 3, gold: 100 }, error: null })),
        })),
      })),
      delete: vi.fn(() => ({ neq: vi.fn(async () => ({ error: null })) })),
    })),
  }
}

describe('Admin /api/admin/level-rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('GET 401 not authed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET()).status).toBe(401)
  })

  it('GET 403 not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await GET()).status).toBe(403)
  })

  it('GET 200 returns rewards', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('PUT 401 not authed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ rewards: [] }) }))
    expect(res.status).toBe(401)
  })

  it('PUT 400 when level missing', async () => {
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({}) }))
    expect(res.status).toBe(400)
  })

  it('PUT 200 saves a level reward', async () => {
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ level: 3, gold: 100 }) }))
    expect(res.status).toBe(200)
  })
})
