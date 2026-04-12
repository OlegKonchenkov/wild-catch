import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from '../route'
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

      if (table === 'player_creatures') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({
                count: 0,
              })),
            })),
          })),
        }
      }

      if (table === 'creatures') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [{ id: 'starter-1', name: 'Volpino' }],
                })),
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table access: ${table}`)
    }),
  }
}

describe('GET /api/game/starters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not offer starter selection for ended sessions', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock('ended') as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await GET(new Request('http://localhost/api/game/starters?sessionId=session-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      alreadyHasCreatures: true,
      starterAvailable: false,
      sessionStatus: 'ended',
      starters: [],
    })
  })

  it('offers starters when the session is ready', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock('ready') as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await GET(new Request('http://localhost/api/game/starters?sessionId=session-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      alreadyHasCreatures: false,
      starterAvailable: true,
      sessionStatus: 'ready',
    })
    expect(body.starters).toHaveLength(1)
  })
})
