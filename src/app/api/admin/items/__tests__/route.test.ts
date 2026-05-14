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
          order: vi.fn(async () => ({ data: [{ id: 'i-1', name: 'Rete', type: 'rete' }], error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 'i-2' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: 'i-1' }, error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
  }
}

function reqJson(method: string, body: unknown) {
  return new Request('http://x', { method, body: JSON.stringify(body) })
}

describe('Admin /api/admin/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('GET 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET()).status).toBe(401)
  })

  it('GET 403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await GET()).status).toBe(403)
  })

  it('GET 200 returns items', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
  })

  it('POST 400 when name missing', async () => {
    const res = await POST(reqJson('POST', { type: 'rete' }))
    expect(res.status).toBe(400)
  })

  it('POST 400 on invalid type', async () => {
    const res = await POST(reqJson('POST', { name: 'X', type: 'INVALID' }))
    expect(res.status).toBe(400)
  })

  it('POST 200 on valid creation', async () => {
    const res = await POST(reqJson('POST', { name: 'Rete++', type: 'rete' }))
    expect(res.status).toBe(200)
  })

  it('PUT 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PUT(reqJson('PUT', { id: 'i-1', name: 'X' }))
    expect(res.status).toBe(401)
  })

  it('DELETE 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await DELETE(reqJson('DELETE', { id: 'i-1' }))
    expect(res.status).toBe(401)
  })
})
