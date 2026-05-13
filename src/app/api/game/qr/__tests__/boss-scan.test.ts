import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/game/missions', () => ({ incrementMissionProgress: vi.fn(() => Promise.resolve([])) }))

import { POST } from '../scan/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function buildBossScanMocks() {
  let insertedBossFight: Record<string, unknown> | null = null

  const qrQuery = {
    or: vi.fn(() => qrQuery),
    eq: vi.fn(() => qrQuery),
    ilike: vi.fn(() => qrQuery),
    single: vi.fn(async () => ({
      data: {
        id: 'qr-boss-1',
        type: 'boss',
        label: 'Capopalestra',
        manual_code: 'BOSS01',
        payload: {
          creature_id: 'boss-1',
          level_override: 4,
          reward: { gold: 50, exp: 25 },
        },
        unique_per_user: false,
        uses_remaining: null,
      },
    })),
  }

  const qrScanSelect = {
    eq: vi.fn(() => qrScanSelect),
    maybeSingle: vi.fn(async () => ({ data: null })),
  }

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'sessions') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { status: 'active' } })) })) })) }
      }
      if (table === 'qr_codes') {
        return {
          select: vi.fn(() => qrQuery),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        }
      }
      if (table === 'qr_scan_log') {
        return {
          select: vi.fn(() => qrScanSelect),
          insert: vi.fn(async () => ({ error: null })),
        }
      }
      return {
        select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })),
        insert: vi.fn(async () => ({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
    }),
  }

  const bossFightSelectQuery = {
    eq: vi.fn(() => bossFightSelectQuery),
    in: vi.fn(() => ({
      order: vi.fn(async () => ({ data: [] })),
    })),
  }

  const adminClient = {
    from: vi.fn((table: string) => {
      if (table === 'creatures') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{
                id: 'boss-1',
                name: 'Gym Boss',
                element: 'bosco',
                hp: 80,
                atk: 22,
                def: 10,
                image_url: '',
                sprite_url: '',
                status_effect: 'sonno',
                status_effect_chance: 1,
              }],
            })),
          })),
        }
      }

      if (table === 'boss_fights') {
        return {
          select: vi.fn(() => bossFightSelectQuery),
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedBossFight = payload
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'fight-1' }, error: null })),
              })),
            }
          }),
        }
      }

      throw new Error(`Unexpected admin table: ${table}`)
    }),
  }

  return { client, adminClient, getInsertedBossFight: () => insertedBossFight }
}

describe('POST /api/game/qr/scan boss payload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores innate boss status fields when creating a new boss fight', async () => {
    const { client, adminClient, getInsertedBossFight } = buildBossScanMocks()
    vi.mocked(createClient).mockResolvedValue(client as any)
    vi.mocked(createAdminClient).mockReturnValue(adminClient as any)

    const res = await POST(new Request('http://localhost/api/game/qr/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', qrId: 'BOSS01' }),
    }))
    const body = await res.json()
    const insertedFight = getInsertedBossFight()

    expect(res.status).toBe(200)
    expect(body.bossFightId).toBe('fight-1')
    expect(insertedFight).toEqual(expect.objectContaining({
      boss_lineup: expect.arrayContaining([
        expect.objectContaining({
          status_effect: 'sonno',
          status_effect_chance: 1,
          active_status: null,
          status_turns_left: 0,
        }),
      ]),
    }))
  })

  it('scopes the existing-fight lookup by session_id (regression: cross-session won fights must not be reused)', async () => {
    // The boss_fights query should chain .eq('user_id', _).eq('qr_code_id', _)
    // .eq('session_id', _).in('status', [...]).order(...). We record every
    // (field, value) pair the route passes to .eq() and assert session_id is
    // among them — otherwise a 'won' fight from a previous session would be
    // served back, surfacing past victory + reward instead of letting the
    // player fight.
    const recordedEqCalls: Array<[string, unknown]> = []
    const { client, adminClient } = buildBossScanMocks()
    const adminFrom = adminClient.from
    adminClient.from = vi.fn((table: string) => {
      if (table === 'boss_fights') {
        const chain = {
          eq: vi.fn((field: string, value: unknown) => {
            recordedEqCalls.push([field, value])
            return chain
          }),
          in: vi.fn(() => ({ order: vi.fn(async () => ({ data: [] })) })),
        }
        return {
          select: vi.fn(() => chain),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'fight-new' }, error: null })) })),
          })),
        }
      }
      return adminFrom(table)
    }) as typeof adminClient.from

    vi.mocked(createClient).mockResolvedValue(client as any)
    vi.mocked(createAdminClient).mockReturnValue(adminClient as any)

    const res = await POST(new Request('http://localhost/api/game/qr/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-B', qrId: 'BOSS01' }),
    }))

    expect(res.status).toBe(200)
    const eqFields = recordedEqCalls.map(([f]) => f)
    expect(eqFields).toContain('session_id')
    const sessionIdCall = recordedEqCalls.find(([f]) => f === 'session_id')
    expect(sessionIdCall?.[1]).toBe('session-B')
  })
})
