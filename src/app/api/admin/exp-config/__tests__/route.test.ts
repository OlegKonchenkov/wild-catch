import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { PUT } from '../route'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { FIXED_EXP_PER_LEVEL_FROM_20, MAX_PLAYER_LEVEL } from '@/lib/game/leveling'

describe('PUT /api/admin/exp-config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })),
      },
      rpc: vi.fn(async (fn: string) => ({ data: fn === 'is_admin' })),
    } as any)
  })

  it('rejects levels above the maximum cap', async () => {
    const upsert = vi.fn()
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    } as any)

    const res = await PUT(new Request('http://localhost/api/admin/exp-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: MAX_PLAYER_LEVEL + 1, exp_to_next: 123 }),
    }))

    expect(res.status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('forces 860 EXP for levels 20 and above', async () => {
    let payloadSeen: Record<string, unknown> | null = null

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        upsert(payload: Record<string, unknown>) {
          payloadSeen = payload
          return {
            select() {
              return {
                single: async () => ({ data: payload, error: null }),
              }
            },
          }
        },
      })),
    } as any)

    const res = await PUT(new Request('http://localhost/api/admin/exp-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 20, exp_to_next: 9999 }),
    }))

    expect(res.status).toBe(200)
    expect(payloadSeen).toEqual({
      level: 20,
      exp_to_next: FIXED_EXP_PER_LEVEL_FROM_20,
    })
  })
})
