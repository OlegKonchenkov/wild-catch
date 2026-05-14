import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { PATCH, DELETE } from '../route'
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
            single: vi.fn(async () => ({ data: { id: 'p-1' }, error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
  }
}

const ctx = { params: Promise.resolve({ id: 'p-1' }) }

describe('Admin /api/admin/session-pins/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('PATCH 401 not authed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({}) }), ctx)
    expect(res.status).toBe(401)
  })

  it('PATCH 403 not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({}) }), ctx)
    expect(res.status).toBe(403)
  })

  it('PATCH 200', async () => {
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ name: 'New' }) }), ctx)
    expect(res.status).toBe(200)
  })

  it('DELETE 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await DELETE(new Request('http://x', { method: 'DELETE' }), ctx)
    expect(res.status).toBe(401)
  })

  it('DELETE 200', async () => {
    const res = await DELETE(new Request('http://x', { method: 'DELETE' }), ctx)
    expect(res.status).toBe(200)
  })
})
