import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

const mockGetUser = vi.fn()

function buildMock(encounter: any) {
  const updateCall = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
  const client = {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'encounters') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: encounter })),
            })) })) })),
          })),
          update: updateCall,
        }
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
  return { client, updateCall }
}

function makeReq(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/game/encounter/clear-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { client } = buildMock({ id: 'enc-1', player_hp: 0 })
    vi.mocked(createClient).mockResolvedValue(client as any)
    const res = await POST(makeReq({ encounterId: 'enc-1' }))
    expect(res.status).toBe(401)
  })

  it('400 when encounterId missing', async () => {
    const { client } = buildMock({ id: 'enc-1', player_hp: 0 })
    vi.mocked(createClient).mockResolvedValue(client as any)
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('404 when encounter not found', async () => {
    const { client } = buildMock(null)
    vi.mocked(createClient).mockResolvedValue(client as any)
    const res = await POST(makeReq({ encounterId: 'enc-1' }))
    expect(res.status).toBe(404)
  })

  it('403 when active creature is still alive (anti-cheat — no free status clear)', async () => {
    const { client, updateCall } = buildMock({ id: 'enc-1', player_hp: 50 })
    vi.mocked(createClient).mockResolvedValue(client as any)
    const res = await POST(makeReq({ encounterId: 'enc-1' }))
    expect(res.status).toBe(403)
    expect(updateCall).not.toHaveBeenCalled()
  })

  it('200 + clears status when player_hp = 0 (legit faint-switch)', async () => {
    const { client, updateCall } = buildMock({ id: 'enc-1', player_hp: 0 })
    vi.mocked(createClient).mockResolvedValue(client as any)
    const res = await POST(makeReq({ encounterId: 'enc-1' }))
    expect(res.status).toBe(200)
    expect(updateCall).toHaveBeenCalledWith(expect.objectContaining({
      player_status: null,
      player_status_turns: 0,
    }))
  })

  it('200 + clears for legacy encounters (player_hp NULL, pre-migration 037)', async () => {
    const { client, updateCall } = buildMock({ id: 'enc-1', player_hp: null })
    vi.mocked(createClient).mockResolvedValue(client as any)
    const res = await POST(makeReq({ encounterId: 'enc-1' }))
    expect(res.status).toBe(200)
    expect(updateCall).toHaveBeenCalled()
  })
})
