import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, POST, PUT, DELETE } from '../route'
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
        order: vi.fn(() => ({
          order: vi.fn(async () => ({ data: [{ id: 'ab-1', name: 'Furia di Magma' }], error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'ab-2' }, error: null })) })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'ab-1' }, error: null })) })) })),
      })),
      delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
  }
}

function reqJson(method: string, body: unknown) {
  return new Request('http://x', { method, body: JSON.stringify(body) })
}

describe('Admin /api/admin/abilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as never)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as never)
  })

  it('GET 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET()).status).toBe(401)
  })

  it('GET 403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await GET()).status).toBe(403)
  })

  it('GET 200 returns abilities', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).abilities).toHaveLength(1)
  })

  it('POST 400 when name missing', async () => {
    const res = await POST(reqJson('POST', { power: 2 }))
    expect(res.status).toBe(400)
  })

  it('POST 400 on invalid category', async () => {
    const res = await POST(reqJson('POST', { name: 'X', category: 'NOPE' }))
    expect(res.status).toBe(400)
  })

  it('POST 400 on invalid target', async () => {
    const res = await POST(reqJson('POST', { name: 'X', target: 'ally' }))
    expect(res.status).toBe(400)
  })

  it('POST 200 on a valid ability', async () => {
    const res = await POST(reqJson('POST', {
      name: 'Furia di Magma', element: 'fiamma', category: 'attacco', power: 2.4,
      recharge_turns: 1, min_level: 30, min_rarity: 'raro', allowed_elements: ['fiamma', 'armonia'],
    }))
    expect(res.status).toBe(200)
  })

  it('PUT 400 when id missing', async () => {
    const res = await PUT(reqJson('PUT', { name: 'X' }))
    expect(res.status).toBe(400)
  })

  it('PUT 200 on valid update', async () => {
    const res = await PUT(reqJson('PUT', { id: 'ab-1', name: 'X' }))
    expect(res.status).toBe(200)
  })

  it('DELETE 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await DELETE(reqJson('DELETE', { id: 'ab-1' }))).status).toBe(401)
  })

  it('DELETE 400 when id missing', async () => {
    expect((await DELETE(reqJson('DELETE', {}))).status).toBe(400)
  })

  it('DELETE 200 on valid delete', async () => {
    expect((await DELETE(reqJson('DELETE', { id: 'ab-1' }))).status).toBe(200)
  })
})
