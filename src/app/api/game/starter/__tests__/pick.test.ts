import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}))

import { POST } from '../pick/route'
import { createClient } from '@/lib/supabase/server'

function buildSupabaseMock(sessionStatus: 'draft' | 'ready' | 'active' | 'ended') {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'sessions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { status: sessionStatus },
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table access: ${table}`)
    }),
  }
}

describe('POST /api/game/starter/pick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects starter picking while the session is still draft', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock('draft') as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const request = new Request('http://localhost/api/game/starter/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', creatureId: 'starter-1' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Sessione non valida')
  })
})
