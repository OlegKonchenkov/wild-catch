import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/game/missions', () => ({ incrementMissionProgress: vi.fn(() => Promise.resolve([])) }))

import { POST } from '../scan/route'
import { createClient } from '@/lib/supabase/server'
import { incrementMissionProgress } from '@/lib/game/missions'

function createMockClient({ existingScan = false }: { existingScan?: boolean } = {}) {
  const sessionSingle = vi.fn(async () => ({ data: { status: 'active' } }))
  const qrSingle = vi.fn(async () => ({
    data: {
      id: 'qr-123',
      type: 'indizio',
      label: 'Boss Nord',
      manual_code: 'BOSS01',
      payload: { chapter_order: 2, text: 'Trova la statua' },
      unique_per_user: false,
      uses_remaining: null,
    },
  }))
  const existingScanMaybeSingle = vi.fn(async () => ({ data: existingScan ? { id: 'scan-1' } : null }))
  const insertScan = vi.fn(async () => ({ error: null }))
  const updateQr = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))

  const qrQuery = {
    or: vi.fn(() => qrQuery),
    eq: vi.fn(() => qrQuery),
    ilike: vi.fn(() => qrQuery),
    single: qrSingle,
  }

  const qrScanSelect: {
    eq: ReturnType<typeof vi.fn>
    maybeSingle: typeof existingScanMaybeSingle
  } = {
    eq: vi.fn(() => qrScanSelect),
    maybeSingle: existingScanMaybeSingle,
  }

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'sessions') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: sessionSingle })) })) }
      }
      if (table === 'qr_codes') {
        return {
          select: vi.fn(() => qrQuery),
          update: updateQr,
        }
      }
      if (table === 'qr_scan_log') {
        return {
          select: vi.fn(() => qrScanSelect),
          insert: insertScan,
        }
      }
      return {
        select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })),
        insert: vi.fn(async () => ({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
    }),
  }

  return { client, insertScan }
}

describe('POST /api/game/qr/scan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 if qrId missing', async () => {
    const { client } = createMockClient()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/qr/scan', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sid' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('tracks QR missions only on the first unique scan and matches id/code/label', async () => {
    const { client, insertScan } = createMockClient({ existingScan: false })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/qr/scan', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sid', qrId: 'BOSS01' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(insertScan).toHaveBeenCalledTimes(1)
    expect(incrementMissionProgress).toHaveBeenCalledWith(expect.objectContaining({
      type: 'qr',
      target: ['qr-123', 'BOSS01', 'Boss Nord'],
      userId: 'u1',
      sessionId: 'sid',
    }))
  })

  it('does not increment QR missions on repeated scans of the same QR', async () => {
    const { client, insertScan } = createMockClient({ existingScan: true })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const req = new Request('http://localhost/api/game/qr/scan', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sid', qrId: 'BOSS01' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(insertScan).not.toHaveBeenCalled()
    expect(incrementMissionProgress).not.toHaveBeenCalled()
  })
})
