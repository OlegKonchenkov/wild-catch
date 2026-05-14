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
            single: vi.fn(async () => ({ data: { id: 'c-1' }, error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
  }
}

const ctx = { params: Promise.resolve({ id: 'c-1' }) }

describe('Admin /api/admin/creatures/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('PATCH 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({}) }), ctx)).status).toBe(401)
  })

  it('PATCH 403 not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({}) }), ctx)).status).toBe(403)
  })

  it('PATCH 200', async () => {
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ name: 'Updated' }) }), ctx)
    expect(res.status).toBe(200)
  })

  it('DELETE 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await DELETE(new Request('http://x', { method: 'DELETE' }), ctx)).status).toBe(401)
  })

  it('DELETE 200', async () => {
    expect((await DELETE(new Request('http://x', { method: 'DELETE' }), ctx)).status).toBe(200)
  })
})
