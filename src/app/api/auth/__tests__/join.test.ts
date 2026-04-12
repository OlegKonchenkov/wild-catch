import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { POST } from '../join/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface AdminMockState {
  invite?: Record<string, unknown> | null
  session?: Record<string, unknown> | null
  existingPlayerSession?: Record<string, unknown> | null
  inviteUpdateError?: { message: string } | null
  playerSessionInsertError?: { message: string } | null
  reteBase?: Record<string, unknown> | null
  inventoryInsertError?: { message: string } | null
  inviteUpdatePayload?: Record<string, unknown> | null
  insertedPlayerSession?: Record<string, unknown> | null
  insertedInventory?: unknown
}

const defaultUserClient = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: 'user1' } }, error: null })),
  },
}

function createAdminMock(state: AdminMockState) {
  return {
    from(table: string) {
      if (table === 'session_invites') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      is() {
                        return {
                          single: async () =>
                            state.invite
                              ? { data: state.invite, error: null }
                              : { data: null, error: { message: 'not found' } },
                        }
                      },
                    }
                  },
                }
              },
            }
          },
          update(payload: Record<string, unknown>) {
            state.inviteUpdatePayload = payload
            return {
              eq: async () => ({ error: state.inviteUpdateError ?? null }),
            }
          },
        }
      }

      if (table === 'sessions') {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () =>
                    state.session
                      ? { data: state.session, error: null }
                      : { data: null, error: { message: 'not found' } },
                }
              },
            }
          },
        }
      }

      if (table === 'player_sessions') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      single: async () =>
                        state.existingPlayerSession
                          ? { data: state.existingPlayerSession, error: null }
                          : { data: null, error: { message: 'not found' } },
                    }
                  },
                }
              },
            }
          },
          insert(payload: Record<string, unknown>) {
            state.insertedPlayerSession = payload
            return Promise.resolve({ error: state.playerSessionInsertError ?? null })
          },
        }
      }

      if (table === 'items') {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () =>
                    state.reteBase
                      ? { data: state.reteBase, error: null }
                      : { data: null, error: { message: 'not found' } },
                }
              },
            }
          },
        }
      }

      if (table === 'player_inventory') {
        return {
          insert(payload: unknown) {
            state.insertedInventory = payload
            return Promise.resolve({ error: state.inventoryInsertError ?? null })
          },
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }
}

describe('POST /api/auth/join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(
      defaultUserClient as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 400 if no code provided', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createAdminMock({}) as unknown as ReturnType<typeof createAdminClient>
    )

    const req = new Request('http://localhost/api/auth/join', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(String(body.error).toLowerCase()).toContain('codice')
  })

  it('returns 404 if code not found', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createAdminMock({ invite: null }) as unknown as ReturnType<typeof createAdminClient>
    )

    const req = new Request('http://localhost/api/auth/join', {
      method: 'POST',
      body: JSON.stringify({ code: 'ABCD1234' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('pre-joins draft sessions and marks invite as consumed', async () => {
    const state: AdminMockState = {
      invite: { id: 'invite1', session_id: 'sess1', is_active: true, used_by_user_id: null },
      session: { id: 'sess1', status: 'draft', starter_kit: [] },
      existingPlayerSession: null,
      reteBase: { id: 'rete-base' },
    }

    vi.mocked(createAdminClient).mockReturnValue(
      createAdminMock(state) as unknown as ReturnType<typeof createAdminClient>
    )

    const req = new Request('http://localhost/api/auth/join', {
      method: 'POST',
      body: JSON.stringify({ code: 'ABCD1234' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      sessionId: 'sess1',
      sessionStatus: 'draft',
      pendingStart: true,
    })
    expect(state.inviteUpdatePayload).toMatchObject({
      used_by_user_id: 'user1',
      is_active: false,
    })
    expect(state.insertedPlayerSession).toMatchObject({
      user_id: 'user1',
      session_id: 'sess1',
      gold: 100,
    })
    expect(state.insertedInventory).toMatchObject({
      user_id: 'user1',
      session_id: 'sess1',
      item_id: 'rete-base',
      quantity: 5,
    })
  })
  it('allows joining ended sessions in view-only mode', async () => {
    const state: AdminMockState = {
      invite: { id: 'invite2', session_id: 'sess2', is_active: true, used_by_user_id: null },
      session: { id: 'sess2', status: 'ended', starter_kit: [] },
      existingPlayerSession: null,
      reteBase: { id: 'rete-base' },
    }

    vi.mocked(createAdminClient).mockReturnValue(
      createAdminMock(state) as unknown as ReturnType<typeof createAdminClient>
    )

    const req = new Request('http://localhost/api/auth/join', {
      method: 'POST',
      body: JSON.stringify({ code: 'ENDED123' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      sessionId: 'sess2',
      sessionStatus: 'ended',
      pendingStart: false,
      viewOnly: true,
    })
    expect(state.inviteUpdatePayload).toMatchObject({
      used_by_user_id: 'user1',
      is_active: false,
    })
    expect(state.insertedPlayerSession).toMatchObject({
      user_id: 'user1',
      session_id: 'sess2',
      gold: 100,
    })
  })
})
