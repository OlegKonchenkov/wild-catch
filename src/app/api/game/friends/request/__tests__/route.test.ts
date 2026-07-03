import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/auth-fast', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ success: true })), rateLimitResponse: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendPushToUser: vi.fn(async () => {}), getDisplayName: vi.fn(async () => 'Oleg') }))
vi.mock('next/server', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return { ...actual, after: vi.fn() }
})

import { POST } from '../route'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'

const USER = { id: 'u1', email: undefined, role: 'authenticated', app_metadata: {}, user_metadata: {} }
const req = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })

let insertSpy: ReturnType<typeof vi.fn>

function buildSupabase(insertError: any = null) {
  insertSpy = vi.fn(async () => ({ error: insertError }))
  return { from: vi.fn(() => ({ insert: insertSpy })) }
}

function buildAdmin(opts: { target?: any; existing?: any } = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') return {
        select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: opts.target === undefined ? { user_id: 'u2', nickname: 'Rivale' } : opts.target }) }) }),
      }
      if (table === 'friendships') return {
        select: () => ({ or: () => ({ maybeSingle: async () => ({ data: opts.existing ?? null }) }) }),
      }
      return {}
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getAuthUser as any).mockResolvedValue({ supabase: buildSupabase(), user: USER })
  ;(createAdminClient as any).mockReturnValue(buildAdmin())
})

describe('POST /api/game/friends/request', () => {
  it('sends a request by exact nickname', async () => {
    const res = await POST(req({ nickname: 'Rivale' }))
    expect(res.status).toBe(200)
    expect(insertSpy).toHaveBeenCalledWith({ requester_id: 'u1', addressee_id: 'u2' })
  })

  it('404 when nickname not found', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ target: null }))
    expect((await POST(req({ nickname: 'Nessuno' }))).status).toBe(404)
  })

  it('400 on self-request', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ target: { user_id: 'u1', nickname: 'Me' } }))
    expect((await POST(req({ nickname: 'Me' }))).status).toBe(400)
  })

  it('409 when a request already exists in either direction', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ existing: { id: 'f1', status: 'pending' } }))
    expect((await POST(req({ nickname: 'Rivale' }))).status).toBe(409)
  })

  it('409 when already friends', async () => {
    ;(createAdminClient as any).mockReturnValue(buildAdmin({ existing: { id: 'f1', status: 'accepted' } }))
    const res = await POST(req({ nickname: 'Rivale' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('già amici')
  })
})
