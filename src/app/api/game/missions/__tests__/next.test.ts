import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from '../next/route'
import { createClient } from '@/lib/supabase/server'

interface MissionFixture {
  id: string
  title: string
  type: string
  target: string | null
  target_count: number
  reward_gold: number
  reward_exp: number
  unlock_level: number | null
  unlock_after_mission_id: string | null
  chapter_order: number | null
}

interface PmFixture {
  mission_id: string
  progress: number
  completed_at: string | null
}

function buildClient(opts: {
  user?: { id: string } | null
  missions?: MissionFixture[]
  playerMissions?: PmFixture[]
  playerLevel?: number
} = {}) {
  const user = opts.user === undefined ? { id: 'user-1' } : opts.user
  const missions = opts.missions ?? []
  const pms = opts.playerMissions ?? []
  const playerLevel = opts.playerLevel ?? 1

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: user ? null : { message: 'auth' },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'missions') {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => ({
              order: vi.fn(async () => ({ data: missions })),
            })),
          })),
        }
      }
      if (table === 'player_missions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: pms })),
            })),
          })),
        }
      }
      if (table === 'player_sessions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { level: playerLevel } })),
              })),
            })),
          })),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

function buildRequest(sessionId: string | null = 'session-1'): Request {
  const url = sessionId
    ? `http://localhost/api/game/missions/next?sessionId=${sessionId}`
    : 'http://localhost/api/game/missions/next'
  return new Request(url)
}

function mission(over: Partial<MissionFixture>): MissionFixture {
  return {
    id: over.id ?? 'm-1',
    title: over.title ?? 'Mission',
    type: over.type ?? 'walk',
    target: over.target ?? null,
    target_count: over.target_count ?? 100,
    reward_gold: over.reward_gold ?? 10,
    reward_exp: over.reward_exp ?? 20,
    unlock_level: over.unlock_level ?? null,
    unlock_after_mission_id: over.unlock_after_mission_id ?? null,
    chapter_order: over.chapter_order ?? 1,
  }
}

describe('GET /api/game/missions/next', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({ user: null }) as any)
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
  })

  it('returns 400 when sessionId is missing', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient() as any)
    const res = await GET(buildRequest(null))
    expect(res.status).toBe(400)
  })

  it('returns null objective when no missions are configured', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({ missions: [] }) as any)
    const res = await GET(buildRequest())
    expect(await res.json()).toEqual({ objective: null })
  })

  it('returns the first unlocked, non-completed mission (relies on supabase chapter_order sort)', async () => {
    // Supabase applies .order('chapter_order', { ascending: true }) in the
    // route — the mock just returns the list verbatim, so we pre-sort to
    // mimic the post-DB order.
    vi.mocked(createClient).mockResolvedValue(buildClient({
      missions: [
        mission({ id: 'm-1', title: 'First',  chapter_order: 1 }),
        mission({ id: 'm-2', title: 'Second', chapter_order: 2 }),
      ],
    }) as any)
    const res = await GET(buildRequest())
    const body = await res.json()
    expect(body.objective.id).toBe('m-1')
    expect(body.objective.title).toBe('First')
  })

  it('skips completed missions', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({
      missions: [
        mission({ id: 'm-1', title: 'First',  chapter_order: 1 }),
        mission({ id: 'm-2', title: 'Second', chapter_order: 2 }),
      ],
      playerMissions: [
        { mission_id: 'm-1', progress: 100, completed_at: '2026-05-13T12:00:00Z' },
      ],
    }) as any)
    const res = await GET(buildRequest())
    const body = await res.json()
    expect(body.objective.id).toBe('m-2')
  })

  it('skips missions locked by level', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({
      playerLevel: 1,
      missions: [
        mission({ id: 'm-1', title: 'Level 5 mission', chapter_order: 1, unlock_level: 5 }),
        mission({ id: 'm-2', title: 'Available',       chapter_order: 2 }),
      ],
    }) as any)
    const res = await GET(buildRequest())
    expect((await res.json()).objective.id).toBe('m-2')
  })

  it('returns progress + reward fields for the chosen mission', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({
      missions: [
        mission({ id: 'm-1', title: 'Walk 500m', type: 'walk', target_count: 500, reward_gold: 25, reward_exp: 50, chapter_order: 1 }),
      ],
      playerMissions: [
        { mission_id: 'm-1', progress: 120, completed_at: null },
      ],
    }) as any)
    const body = await (await GET(buildRequest())).json()
    expect(body.objective).toEqual(expect.objectContaining({
      id: 'm-1',
      title: 'Walk 500m',
      type: 'walk',
      target_count: 500,
      progress: 120,
      reward_gold: 25,
      reward_exp: 50,
      chapter_order: 1,
    }))
  })

  it('returns objective:null when all missions are completed', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient({
      missions: [
        mission({ id: 'm-1', chapter_order: 1 }),
        mission({ id: 'm-2', chapter_order: 2 }),
      ],
      playerMissions: [
        { mission_id: 'm-1', progress: 100, completed_at: '2026-05-13T11:00:00Z' },
        { mission_id: 'm-2', progress: 100, completed_at: '2026-05-13T12:00:00Z' },
      ],
    }) as any)
    expect((await (await GET(buildRequest())).json()).objective).toBeNull()
  })
})
