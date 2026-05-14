import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabaseMock() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdminMock({ creatures = [] as any[], insertReturn = { id: 'c-1' } as any } = {}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(async () => ({ data: creatures, error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: insertReturn, error: null })),
        })),
      })),
    })),
  }
}

describe('Admin /api/admin/creatures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  describe('GET', () => {
    it('401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
      const res = await GET()
      expect(res.status).toBe(401)
    })

    it('403 when not admin', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null })
      const res = await GET()
      expect(res.status).toBe(403)
    })

    it('200 returns creatures list', async () => {
      vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
        creatures: [{ id: 'c-1', name: 'Test' }],
      }) as any)
      const res = await GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.creatures).toHaveLength(1)
    })
  })

  describe('POST', () => {
    function makeReq(body: any) {
      return new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
    }

    it('401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
      const res = await POST(makeReq({ name: 'X', rarity: 'comune', element: 'fiamma' }))
      expect(res.status).toBe(401)
    })

    it('403 when not admin', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null })
      const res = await POST(makeReq({ name: 'X', rarity: 'comune', element: 'fiamma' }))
      expect(res.status).toBe(403)
    })

    it('400 when name missing', async () => {
      const res = await POST(makeReq({ rarity: 'comune', element: 'fiamma' }))
      expect(res.status).toBe(400)
    })

    it('400 on invalid rarity', async () => {
      const res = await POST(makeReq({ name: 'X', rarity: 'INVALID', element: 'fiamma' }))
      expect(res.status).toBe(400)
    })

    it('400 on invalid element', async () => {
      const res = await POST(makeReq({ name: 'X', rarity: 'comune', element: 'INVALID' }))
      expect(res.status).toBe(400)
    })

    it('201 on valid creation', async () => {
      const res = await POST(makeReq({ name: 'Fiammare', rarity: 'comune', element: 'fiamma' }))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.creature).toBeDefined()
    })
  })
})
