import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { POST, GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockIsAdmin  = vi.fn()

function buildSupabaseMock(isAdmin = true) {
  return {
    auth: { getUser: mockGetUser },
    rpc: vi.fn(async () => ({ data: isAdmin })),
  }
}

const QR_ROW = { id: 'qr-1', type: 'oggetto', payload: { item_id: 'item-1' }, manual_code: 'ABCD12' }

function buildAdminMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'qr_codes') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })),
          order: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [QR_ROW] })) })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: QR_ROW, error: null })),
          })),
        })),
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('POST /api/admin/qrcodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock(true) as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ type: 'oggetto', payload: {} }),
    }))
    expect(res.status).toBe(401)
  })

  it('403 when user is not admin', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock(false) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ type: 'oggetto', payload: {} }),
    }))
    expect(res.status).toBe(403)
  })

  it('400 when type or payload is missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ type: 'oggetto' }),
    }))
    expect(res.status).toBe(400)
  })

  it('200 returns created qrCode', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ type: 'oggetto', payload: { item_id: 'item-1' } }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.qrCode).toBeDefined()
    expect(body.qrCode.type).toBe('oggetto')
  })
})

describe('GET /api/admin/qrcodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildSupabaseMock(true) as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(401)
  })

  it('200 returns qrCodes array', async () => {
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.qrCodes)).toBe(true)
  })
})
