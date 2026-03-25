import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { POST } from '../connect/route'
import { createClient } from '@/lib/supabase/server'

describe('POST /api/game/duel/connect', () => {
  it('returns 400 if sessionId missing', async () => {
    const mock = {
      auth: { getUser: vi.fn(() => ({ data: { user: { id: 'u1' } }, error: null })) },
    }
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const req = new Request('http://localhost/api/game/duel/connect', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
