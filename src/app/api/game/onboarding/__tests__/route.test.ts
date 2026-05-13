import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

function buildClient(opts: {
  user?: { id: string } | null
  updateResult?: { data: { onboarding_seen: boolean } | null; error: { message: string } | null }
} = {}) {
  const user = opts.user === undefined ? { id: 'user-1' } : opts.user
  const updateResult = opts.updateResult ?? { data: { onboarding_seen: true }, error: null }
  const maybeSingle = vi.fn(async () => updateResult)

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: user ? null : { message: 'auth' },
      })),
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({ maybeSingle })),
          })),
        })),
      })),
    })),
  }
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/game/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/game/onboarding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when the caller is not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({ user: null }) as any)
    const res = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when sessionId is missing', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient() as any)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when no player_session row matches user + session', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({
      updateResult: { data: null, error: null },
    }) as any)
    const res = await POST(makeRequest({ sessionId: 'unknown-session' }))
    expect(res.status).toBe(404)
  })

  it('marks the flag true by default and returns it', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({
      updateResult: { data: { onboarding_seen: true }, error: null },
    }) as any)
    const res = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ onboardingSeen: true })
  })

  it('accepts seen=false to re-arm the flag (replay tutorial)', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({
      updateResult: { data: { onboarding_seen: false }, error: null },
    }) as any)
    const res = await POST(makeRequest({ sessionId: 'session-1', seen: false }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ onboardingSeen: false })
  })

  it('returns 500 on supabase update error', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({
      updateResult: { data: null, error: { message: 'db down' } },
    }) as any)
    const res = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(res.status).toBe(500)
  })
})
