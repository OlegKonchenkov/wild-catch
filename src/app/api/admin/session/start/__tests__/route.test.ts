import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/server', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return { ...actual, after: vi.fn() }
})

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

function buildMock(isAdmin = true, sessionStatus = 'ready') {
  return {
    auth: { getUser: mockGetUser },
    rpc: vi.fn(async () => ({ data: isAdmin })),
    from: vi.fn((table: string) => {
      if (table === 'sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { status: sessionStatus, duration_minutes: 60 },
            })),
          })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('POST /api/admin/session/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue(buildMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(401)
  })

  it('403 when user is not admin', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock(false) as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(403)
  })

  it('400 when session status is not ready', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMock(true, 'active') as any)
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(400)
  })

  it('200 started:true with endAt when session is ready', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.started).toBe(true)
    expect(typeof body.endAt).toBe('string')
  })
})
