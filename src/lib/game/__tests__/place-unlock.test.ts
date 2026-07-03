import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/game/rewards/dispense', () => ({
  dispenseReward: vi.fn(async (_c: any, input: any) => ({ type: input.type, ok: true, detail: {} })),
}))

import { unlockPlaceIfGuardian } from '../place-unlock'
import { dispenseReward } from '@/lib/game/rewards/dispense'

let insertSpy: ReturnType<typeof vi.fn>

function makeClient(opts: {
  placeId?: string | null
  existingUnlock?: boolean
  place?: { name: string; unlock_bonus: any }
  insertError?: any
} = {}) {
  insertSpy = vi.fn(async () => ({ error: opts.insertError ?? null }))
  const eventInsert = vi.fn(() => Promise.resolve({ error: null }))
  return {
    from: vi.fn((table: string) => {
      if (table === 'session_map_pins') return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { place_id: opts.placeId === undefined ? 'pl1' : opts.placeId } }) }) }),
      }
      if (table === 'player_place_unlocks') return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: opts.existingUnlock ? { id: 'u1' } : null }),
        }) }) }) }),
        insert: insertSpy,
      }
      if (table === 'cultural_places') return {
        select: () => ({ eq: () => ({ single: async () => ({
          data: opts.place ?? { name: 'Foro Romano', unlock_bonus: [{ type: 'gemme', payload: { amount: 20 } }] },
        }) }) }),
      }
      if (table === 'player_game_events') return { insert: eventInsert }
      return {}
    }),
  } as any
}

beforeEach(() => vi.clearAllMocks())

describe('unlockPlaceIfGuardian', () => {
  it('unlocks the place and dispenses the bonus on first win', async () => {
    const c = makeClient()
    const r = await unlockPlaceIfGuardian(c, 'u1', 's1', 'pin1')
    expect(r?.placeName).toBe('Foro Romano')
    expect(r?.drops).toHaveLength(1)
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ place_id: 'pl1' }))
    expect((dispenseReward as any).mock.calls[0][1]).toMatchObject({ type: 'gemme', payload: { amount: 20 } })
  })

  it('returns null when the pin guards no place', async () => {
    const r = await unlockPlaceIfGuardian(makeClient({ placeId: null }), 'u1', 's1', 'pin1')
    expect(r).toBeNull()
    expect(dispenseReward).not.toHaveBeenCalled()
  })

  it('returns null (no double bonus) when already unlocked', async () => {
    const r = await unlockPlaceIfGuardian(makeClient({ existingUnlock: true }), 'u1', 's1', 'pin1')
    expect(r).toBeNull()
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('returns null on concurrent insert collision', async () => {
    const r = await unlockPlaceIfGuardian(makeClient({ insertError: { code: '23505' } }), 'u1', 's1', 'pin1')
    expect(r).toBeNull()
    expect(dispenseReward).not.toHaveBeenCalled()
  })

  it('handles a place with no bonus configured', async () => {
    const c = makeClient({ place: { name: 'Teatro', unlock_bonus: null } })
    const r = await unlockPlaceIfGuardian(c, 'u1', 's1', 'pin1')
    expect(r?.placeName).toBe('Teatro')
    expect(r?.drops).toHaveLength(0)
  })
})
