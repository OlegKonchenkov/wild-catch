import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { POST } from '../scan/route'
import { createClient } from '@/lib/supabase/server'

describe('POST /api/game/qr/scan', () => {
  it('returns 400 if qrId missing', async () => {
    const mockClient = {
      auth: { getUser: vi.fn(() => ({ data: { user: { id: 'u1' } }, error: null })) },
    }
    vi.mocked(createClient).mockResolvedValue(mockClient as any)

    const req = new Request('http://localhost/api/game/qr/scan', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sid' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
