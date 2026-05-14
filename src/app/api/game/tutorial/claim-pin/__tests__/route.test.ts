import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitResponse: vi.fn(),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()

function buildAdminMock({
  playerSession = { id: 'ps-1' } as any,
  existingClaim = null as any,
  insertError = null as any,
}: any = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: playerSession })),
          })) })),
        })),
      }
      if (table === 'player_enigma_suggerimenti') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: existingClaim })),
          })) })) })),
        })),
        insert: vi.fn(async () => ({ error: insertError })),
      }
      if (table === 'player_game_events') return {
        insert: vi.fn(() => ({ then: (_: any, __: any) => undefined })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

describe('POST /api/game/tutorial/claim-pin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: mockGetUser } } as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('404 when player is not enrolled in tutorial', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({ playerSession: null }) as any)
    const res = await POST()
    expect(res.status).toBe(404)
  })

  it('200 alreadyClaimed:true when player has already claimed (idempotent)', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
      existingClaim: { id: 'pes-1' },
    }) as any)
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyClaimed).toBe(true)
  })

  it('200 alreadyClaimed:false on first successful claim', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyClaimed).toBe(false)
    expect(body.suggerimentoId).toBeDefined()
  })

  it('200 alreadyClaimed:true when insert races and hits 23505 (duplicate-key)', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
      insertError: { code: '23505', message: 'duplicate key' },
    }) as any)
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyClaimed).toBe(true)
  })

  it('500 on unexpected insert error', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
      insertError: { code: '42P01', message: 'relation does not exist' },
    }) as any)
    const res = await POST()
    expect(res.status).toBe(500)
  })
})
