import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, DELETE } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabase() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdmin({ inventory = [{ id: 'inv-1', item_id: 'i', quantity: 5 }], row = { id: 'inv-1', quantity: 5 } as any } = {}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: inventory, error: null })),
          })),
          single: vi.fn(async () => ({ data: row })),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
  }
}

function makeReq(method: string, url = 'http://x', body?: unknown) {
  return new Request(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
}

describe('Admin /api/admin/players/inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('GET 401 not authed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET(makeReq('GET', 'http://x?userId=u&sessionId=s'))).status).toBe(401)
  })

  it('GET 403 not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await GET(makeReq('GET', 'http://x?userId=u&sessionId=s'))).status).toBe(403)
  })

  it('GET 400 missing params', async () => {
    expect((await GET(makeReq('GET', 'http://x?userId=u'))).status).toBe(400)
  })

  it('GET 200 returns inventory', async () => {
    const res = await GET(makeReq('GET', 'http://x?userId=u&sessionId=s'))
    expect(res.status).toBe(200)
  })

  it('DELETE 400 missing inventoryId', async () => {
    expect((await DELETE(makeReq('DELETE', 'http://x', {}))).status).toBe(400)
  })

  it('DELETE 404 when not found', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin({ row: null }) as any)
    expect((await DELETE(makeReq('DELETE', 'http://x', { inventoryId: 'inv-1' }))).status).toBe(404)
  })

  it('DELETE 200 deletes full quantity', async () => {
    const res = await DELETE(makeReq('DELETE', 'http://x', { inventoryId: 'inv-1' }))
    expect(res.status).toBe(200)
  })

  it('DELETE 200 partial quantity (decrement)', async () => {
    const res = await DELETE(makeReq('DELETE', 'http://x', { inventoryId: 'inv-1', quantity: 2 }))
    expect(res.status).toBe(200)
  })
})
