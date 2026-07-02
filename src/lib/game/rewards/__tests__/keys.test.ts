import { describe, it, expect } from 'vitest'
import { checkKeyRequirements } from '../keys'

describe('checkKeyRequirements', () => {
  it('passes when every requirement is met', () => {
    const r = checkKeyRequirements(
      [{ item_id: 'bronze', qty: 1 }, { item_id: 'silver', qty: 2 }],
      { bronze: 1, silver: 3 },
    )
    expect(r.ok).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('reports the shortfall for a missing key type', () => {
    const r = checkKeyRequirements(
      [{ item_id: 'gold', qty: 2 }],
      { gold: 1 },
    )
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual([{ item_id: 'gold', needed: 2, have: 1 }])
  })

  it('handles multiple mixed key types', () => {
    const r = checkKeyRequirements(
      [{ item_id: 'bronze', qty: 1 }, { item_id: 'silver', qty: 1 }],
      { bronze: 1 },
    )
    expect(r.ok).toBe(false)
    expect(r.missing.map(m => m.item_id)).toEqual(['silver'])
  })

  it('treats an empty requirement list as always satisfied', () => {
    expect(checkKeyRequirements([], {}).ok).toBe(true)
  })
})
