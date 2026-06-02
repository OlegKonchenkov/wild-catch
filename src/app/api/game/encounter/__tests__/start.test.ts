import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}))
// The route now reads the spawnable pool via config-cache (admin client + in-mem
// TTL). Mock the cache helper so tests don't need to wire the admin client.
vi.mock('@/lib/game/config-cache', () => ({
  getSpawnableCreatures: vi.fn(async () => [
    { id: 'wild-1', spawn_weight: 100, rarity: 'comune', min_level: 1, hp: 30, element: 'fiamma' },
  ]),
}))

import { POST } from '../start/route'
import { createClient } from '@/lib/supabase/server'

function buildSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'player_sessions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: 'ps-1',
                    level: 1,
                    selected_creature_id: null,
                    squad_ids: [],
                  },
                })),
              })),
            })),
          })),
        }
      }

      if (table === 'sessions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  status: 'active',
                  area_bounds: null,
                },
              })),
            })),
          })),
        }
      }

      if (table === 'encounters') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  lt: vi.fn(async () => ({ error: null })),
                })),
              })),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null })),
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

describe('POST /api/game/encounter/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock() as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('blocks encounter creation when the player has no starter or squad', async () => {
    const request = new Request('http://localhost/api/game/encounter/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', trigger: 'gps' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.requiresStarter).toBe(true)
    expect(body.error).toContain('starter')
  })
})
