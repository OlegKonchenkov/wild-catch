import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabase() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdmin({
  session = { status: 'active' } as any,
  qr = { id: 'qr-1', type: 'oggetto', payload: { item_id: 'item-1' }, label: 'Test' } as any,
  item = { id: 'item-1', name: 'Premio', type: 'custom', is_redeemable: true, reward: { gold: 100 } } as any,
}: any = {}) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => {
            if (table === 'sessions') return { data: session }
            if (table === 'qr_codes') return { data: qr }
            if (table === 'items') return { data: item }
            if (table === 'player_sessions') return { data: { gold: 50 } }
            return { data: null }
          }),
          maybeSingle: vi.fn(async () => ({ data: qr })),
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { gold: 50 } })),
            maybeSingle: vi.fn(async () => ({ data: null })),
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null })),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })), then: undefined })),
      })),
      insert: vi.fn(async () => ({ error: null })),
    })),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }
}

function makeReq(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
}

describe('Admin /api/admin/players/redeem-qr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(makeReq({ userId: 'u', sessionId: 's', qrContent: 'qr' }))).status).toBe(401)
  })

  it('403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await POST(makeReq({ userId: 'u', sessionId: 's', qrContent: 'qr' }))).status).toBe(403)
  })

  it('400 when params missing', async () => {
    expect((await POST(makeReq({ userId: 'u' }))).status).toBe(400)
  })

  it('403 when session not active', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin({
      session: { status: 'ended' },
    }) as any)
    expect((await POST(makeReq({ userId: 'u', sessionId: 's', qrContent: 'qr' }))).status).toBe(403)
  })

  it('400 when QR is not type=oggetto', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin({
      qr: { id: 'qr-1', type: 'boss', payload: {}, label: 'Boss' },
    }) as any)
    expect((await POST(makeReq({ userId: 'u', sessionId: 's', qrContent: 'qr' }))).status).toBe(400)
  })

  it('400 when item is not custom redeemable', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin({
      item: { id: 'i', name: 'X', type: 'rete', is_redeemable: false, reward: {} },
    }) as any)
    expect((await POST(makeReq({ userId: 'u', sessionId: 's', qrContent: 'qr' }))).status).toBe(400)
  })
})
