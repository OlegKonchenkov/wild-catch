import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { POST } from '../join/route'
import { createClient } from '@/lib/supabase/server'

const defaultMockSupabase = {
  from: vi.fn(),
  auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user1' } }, error: null })) },
}

describe('POST /api/auth/join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(defaultMockSupabase as any)
  })

  it('returns 400 if no code provided', async () => {
    const req = new Request('http://localhost/api/auth/join', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('codice')
  })

  it('returns 404 if code not found', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: null, error: { message: 'not found' } })),
            })),
          })),
        })),
      })),
      auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user1' } }, error: null })) },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = new Request('http://localhost/api/auth/join', {
      method: 'POST',
      body: JSON.stringify({ code: 'ABCD1234' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })
})
