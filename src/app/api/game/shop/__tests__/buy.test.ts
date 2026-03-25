import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { POST } from '../buy/route'
import { createClient } from '@/lib/supabase/server'

describe('POST /api/game/shop/buy', () => {
  it('returns 400 if no itemId', async () => {
    const mock = {
      auth: { getUser: vi.fn(() => ({ data: { user: { id: 'u1' } }, error: null })) },
    }
    vi.mocked(createClient).mockResolvedValue(mock as any)
    const req = new Request('http://localhost/api/game/shop/buy', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sid' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
