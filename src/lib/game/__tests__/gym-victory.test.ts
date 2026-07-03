import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/game/rewards/dispense', () => ({
  dispenseReward: vi.fn(async (_c: any, input: any) => ({ type: input.type, ok: true, detail: {} })),
}))
vi.mock('@/lib/push', () => ({
  sendPushToUser: vi.fn(async () => {}),
}))

import { handleGymVictory } from '../gym-victory'
import { dispenseReward } from '@/lib/game/rewards/dispense'
import { sendPushToUser } from '@/lib/push'

function makeClient(opts: {
  gym?: boolean
  pinName?: string
  hold?: { id: string; holder_id: string; held_since: string } | null
  insertError?: any
} = {}) {
  const updateSpy = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
  const insertSpy = vi.fn(async () => ({ error: opts.insertError ?? null }))
  const eventInsert = vi.fn(() => Promise.resolve({ error: null }))

  return {
    from: vi.fn((table: string) => {
      if (table === 'session_map_pins') return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { reward_payload: opts.gym === false ? {} : { gym: true }, name: opts.pinName ?? 'Palestra del Foro' },
        }) }) }),
      }
      if (table === 'gym_holds') return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.hold === undefined ? null : opts.hold }) }) }) }),
        update: updateSpy,
        insert: insertSpy,
      }
      if (table === 'player_game_events') return { insert: eventInsert }
      return {}
    }),
    __updateSpy: updateSpy,
    __insertSpy: insertSpy,
    __eventInsert: eventInsert,
  } as any
}

beforeEach(() => vi.clearAllMocks())

describe('handleGymVictory', () => {
  it('returns null when the pin is not a gym', async () => {
    const c = makeClient({ gym: false })
    const r = await handleGymVictory(c, 'winner1', 's1', 'pin1')
    expect(r).toBeNull()
    expect(dispenseReward).not.toHaveBeenCalled()
  })

  it('first-ever hold: taken, no dethrone, no gold/push', async () => {
    const c = makeClient({ hold: null })
    const r = await handleGymVictory(c, 'winner1', 's1', 'pin1')
    expect(r).toEqual({ taken: true, dethroned: null })
    expect(c.__insertSpy).toHaveBeenCalledWith(expect.objectContaining({ pin_id: 'pin1', session_id: 's1', holder_id: 'winner1' }))
    expect(dispenseReward).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('no-op when the winner already holds the gym', async () => {
    const c = makeClient({ hold: { id: 'h1', holder_id: 'winner1', held_since: new Date().toISOString() } })
    const r = await handleGymVictory(c, 'winner1', 's1', 'pin1')
    expect(r).toEqual({ taken: false, dethroned: null })
    expect(c.__updateSpy).not.toHaveBeenCalled()
    expect(c.__insertSpy).not.toHaveBeenCalled()
  })

  it('dethrones the prior holder: pays accrued gold + pushes them', async () => {
    const heldSince = new Date(Date.now() - 3 * 3_600_000).toISOString() // 3h ago -> 30 gold
    const c = makeClient({ hold: { id: 'h1', holder_id: 'oldholder', held_since: heldSince } })
    const r = await handleGymVictory(c, 'winner1', 's1', 'pin1')
    expect(r?.taken).toBe(true)
    expect(r?.dethroned).toEqual({ holderId: 'oldholder', accruedGold: 30 })
    expect(c.__updateSpy).toHaveBeenCalledWith(expect.objectContaining({ holder_id: 'winner1' }))
    expect(dispenseReward).toHaveBeenCalledWith(c, expect.objectContaining({
      userId: 'oldholder', sessionId: 's1', type: 'gold', payload: { amount: 30 },
    }))
    expect(sendPushToUser).toHaveBeenCalledWith('oldholder', expect.objectContaining({ title: expect.stringContaining('spodestato') }))
  })

  it('dethrones without gold payout when nothing accrued yet (fresh hold)', async () => {
    const c = makeClient({ hold: { id: 'h1', holder_id: 'oldholder', held_since: new Date().toISOString() } })
    const r = await handleGymVictory(c, 'winner1', 's1', 'pin1')
    expect(r?.dethroned).toEqual({ holderId: 'oldholder', accruedGold: 0 })
    expect(dispenseReward).not.toHaveBeenCalled()
    expect(sendPushToUser).toHaveBeenCalled() // still notified, just no gold mention
  })

  it('treats a concurrent insert collision as a non-dethroning take', async () => {
    const c = makeClient({ hold: null, insertError: { code: '23505', message: 'dup' } })
    const r = await handleGymVictory(c, 'winner1', 's1', 'pin1')
    expect(r).toEqual({ taken: false, dethroned: null })
  })
})
