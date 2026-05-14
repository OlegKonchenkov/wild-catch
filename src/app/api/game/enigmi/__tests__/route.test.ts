import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()

const ENIGMA = {
  id: 'enigma-1',
  session_id: 'sess-1',
  title: "L'enigma del bosco",
  description: 'Indovina la parola misteriosa',
  difficulty: 'medio',
  reward_type: 'gold',
  created_at: '2026-05-15T10:00:00Z',
  frammenti: [
    { id: 'fr-1', enigma_id: 'enigma-1', title: 'Frammento A', description: 'Pezzo A', image_url: null, video_url: null, order_index: 1 },
    { id: 'fr-2', enigma_id: 'enigma-1', title: 'Frammento B', description: 'Pezzo B', image_url: null, video_url: null, order_index: 2 },
  ],
  suggerimenti: [
    { id: 'sg-1', enigma_id: 'enigma-1', text: 'Inizia con A', image_url: null, order_index: 1 },
  ],
}

function buildAdminMock({
  enigmi = [ENIGMA],
  playerCreatureFramments = [] as Array<{ creature_id: string; creatures: { enigma_frammento_id: string | null } }>,
  directFrammenti = [] as Array<{ frammento_id: string }>,
  collectedSuggerimenti = [] as Array<{ suggerimento_id: string }>,
  solvedEnigmi = [] as Array<{ enigma_id: string }>,
}: any = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'enigmi') return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: enigmi, error: null })),
            or: vi.fn(async () => ({ data: enigmi, error: null })),
          })),
        })),
      }
      if (table === 'player_creatures') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({
            not: vi.fn(async () => ({ data: playerCreatureFramments })),
          })) })),
        })),
      }
      if (table === 'player_enigma_frammenti') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ data: directFrammenti })) })),
        })),
      }
      if (table === 'player_enigma_suggerimenti') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ data: collectedSuggerimenti })) })),
        })),
      }
      if (table === 'player_enigmi') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(async () => ({ data: solvedEnigmi })) })),
        })),
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })) }
    }),
  }
}

function makeRequest(url: string) {
  return new Request(url, { method: 'GET' })
}

describe('GET /api/game/enigmi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: mockGetUser } } as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock() as any)
  })

  it('401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    expect(res.status).toBe(401)
  })

  it('400 when sessionId is missing', async () => {
    const res = await GET(makeRequest('http://x'))
    expect(res.status).toBe(400)
  })

  it('returns enigmi with frammenti/suggerimenti as locked when player has none', async () => {
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enigmi).toHaveLength(1)
    expect(body.enigmi[0].id).toBe('enigma-1')
    // Solution is NEVER exposed
    expect((body.enigmi[0] as any).solution).toBeUndefined()
    // Frammenti locked when player doesn't have them
    expect(body.enigmi[0].frammenti[0].collected).toBe(false)
    expect(body.enigmi[0].frammenti[0].title).toBeNull()  // hidden content
    expect(body.enigmi[0].frammenti_collected).toBe(0)
    expect(body.enigmi[0].frammenti_total).toBe(2)
  })

  it('reveals frammento content when player has it via direct grant', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
      directFrammenti: [{ frammento_id: 'fr-1' }],
    }) as any)
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    const body = await res.json()
    const f1 = body.enigmi[0].frammenti.find((f: any) => f.id === 'fr-1')
    expect(f1.collected).toBe(true)
    expect(f1.title).toBe('Frammento A')
    expect(body.enigmi[0].frammenti_collected).toBe(1)
  })

  it('marks solved=true when player_enigmi row exists', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildAdminMock({
      solvedEnigmi: [{ enigma_id: 'enigma-1' }],
    }) as any)
    const res = await GET(makeRequest('http://x?sessionId=sess-1'))
    const body = await res.json()
    expect(body.enigmi[0].solved).toBe(true)
  })
})
