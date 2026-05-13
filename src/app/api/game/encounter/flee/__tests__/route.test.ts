import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitResponse: vi.fn(),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

function buildMock() {
  const lastEq  = vi.fn(async () => ({ error: null }))
  const eq2     = vi.fn(() => ({ eq: lastEq }))
  const eq1     = vi.fn(() => ({ eq: eq2 }))
  const update  = vi.fn(() => ({ eq: eq1 }))
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({ update })),
  }
}

describe('POST /api/game/encounter/flee', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('400 when encounterId is missing', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('200 and ok:true on valid flee', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ encounterId: 'enc-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
