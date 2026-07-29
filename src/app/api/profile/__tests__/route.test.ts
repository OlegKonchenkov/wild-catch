import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockDeleteUser = vi.fn()
const mockCaptureException = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ auth: { admin: { deleteUser: mockDeleteUser } } })),
}))
vi.mock('@/lib/supabase/auth-fast', () => ({ getAuthUser: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => mockCaptureException(...a) }))

import { DELETE } from '../route'

/**
 * GDPR art. 17. This endpoint relies entirely on FK cascades (migration 082):
 * before that, most foreign keys into auth.users sat on the Postgres default of
 * NO ACTION, so deleteUser() raised a foreign-key violation for any account that
 * had ever played and the delete button simply returned 500. These tests cover
 * the route's contract; the constraint state itself is asserted by the guard
 * block at the end of migration 082, which fails the migration if any blocking
 * FK survives.
 */
describe('DELETE /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockDeleteUser.mockResolvedValue({ error: null })
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await DELETE()
    expect(res.status).toBe(401)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('deletes the auth user and reports success', async () => {
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockDeleteUser).toHaveBeenCalledWith('user-1')
  })

  it('never deletes an id other than the caller\'s own', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-42' } } })
    await DELETE()
    expect(mockDeleteUser).toHaveBeenCalledTimes(1)
    expect(mockDeleteUser).toHaveBeenCalledWith('user-42')
  })

  // A failed erasure means a user could not exercise a legal right: it must be
  // reported, not swallowed, and the raw Postgres text must not reach the user.
  it('reports a failure to Sentry and returns a human message', async () => {
    mockDeleteUser.mockResolvedValue({
      error: { message: 'update or delete on table "users" violates foreign key constraint' },
    })

    const res = await DELETE()
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error).not.toContain('foreign key')
    expect(body.error).toMatch(/account/i)

    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    const [, ctx] = mockCaptureException.mock.calls[0] as [unknown, { tags: Record<string, string> }]
    expect(ctx.tags).toMatchObject({ area: 'gdpr', operation: 'account_delete' })
  })
})
