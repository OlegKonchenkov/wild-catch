import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabase() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdmin({ players = [{ user_id: 'u-1', session_id: 's-1' }] } = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'player_sessions') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: players })),
          })),
        })),
      }
      if (table === 'profiles') return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [] })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [] })) })) }
    }),
    // admin.auth.admin.listUsers — used to enrich players with emails
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
      },
    },
  }
}

describe('Admin /api/admin/players', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET(new Request('http://x?sessionId=s'))).status).toBe(401)
  })

  it('403 when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await GET(new Request('http://x?sessionId=s'))).status).toBe(403)
  })

  it('400 when sessionId missing', async () => {
    expect((await GET(new Request('http://x'))).status).toBe(400)
  })

  it('200 returns players list', async () => {
    const res = await GET(new Request('http://x?sessionId=s'))
    expect(res.status).toBe(200)
  })
})
