import { describe, it, expect, vi } from 'vitest'
import { checkTrophies } from '../collection'

/**
 * Awaitable query stub: `.select().eq().eq()` all return the same thenable that
 * resolves to { data }. `table` decides which dataset to return.
 */
function makeClient(data: Record<string, any[]>, insertSpy = vi.fn(async () => ({ error: null }))) {
  function node(table: string): any {
    const n: any = {}
    n.select = () => n
    n.eq = () => n
    n.then = (res: any) => res({ data: data[table] ?? [] })
    n.insert = insertSpy
    return n
  }
  return { from: vi.fn((t: string) => node(t)), __insert: insertSpy } as any
}

describe('checkTrophies', () => {
  it('awards a category trophy when the player owns every entry of the kind', async () => {
    const c = makeClient({
      trophies: [{ id: 't1', name: 'Pantheon', criteria: { kind: 'personaggio', complete_all: true } }],
      player_trophies: [],
      player_collection: [
        { kind: 'personaggio', ref_id: 'p1' },
        { kind: 'personaggio', ref_id: 'p2' },
      ],
      characters: [{ id: 'p1' }, { id: 'p2' }],
    })
    const awarded = await checkTrophies(c, 'u1', 's1')
    expect(awarded).toEqual([{ id: 't1', name: 'Pantheon' }])
    expect(c.__insert).toHaveBeenCalledWith(expect.objectContaining({ trophy_id: 't1' }))
  })

  it('does not award when the collection is incomplete', async () => {
    const c = makeClient({
      trophies: [{ id: 't1', name: 'Pantheon', criteria: { kind: 'personaggio', complete_all: true } }],
      player_trophies: [],
      player_collection: [{ kind: 'personaggio', ref_id: 'p1' }],
      characters: [{ id: 'p1' }, { id: 'p2' }],
    })
    const awarded = await checkTrophies(c, 'u1', 's1')
    expect(awarded).toEqual([])
    expect(c.__insert).not.toHaveBeenCalled()
  })

  it('skips trophies already awarded', async () => {
    const c = makeClient({
      trophies: [{ id: 't1', name: 'Pantheon', criteria: { kind: 'personaggio', complete_all: true } }],
      player_trophies: [{ trophy_id: 't1' }],
      player_collection: [{ kind: 'personaggio', ref_id: 'p1' }],
      characters: [{ id: 'p1' }],
    })
    const awarded = await checkTrophies(c, 'u1', 's1')
    expect(awarded).toEqual([])
  })
})
