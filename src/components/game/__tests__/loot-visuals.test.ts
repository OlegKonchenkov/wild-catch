import { describe, expect, it } from 'vitest'
import { describeDrop } from '../loot-visuals'

describe('describeDrop', () => {
  it('exposes rarity for an oggetto drop', () => {
    const v = describeDrop('oggetto', { itemName: 'Erba curativa', rarity: 'raro' })
    expect(v.rarity).toBe('raro')
  })

  it('exposes rarity from eggRarity for an uovo drop', () => {
    const v = describeDrop('uovo', { eggRarity: 'epico' })
    expect(v.rarity).toBe('epico')
  })

  it('exposes rarity from the nested creature for a creatura drop', () => {
    const v = describeDrop('creatura', { creature: { name: 'Grifone', rarity: 'leggendario' } })
    expect(v.rarity).toBe('leggendario')
  })

  it('exposes rarity for personaggio and opera drops', () => {
    expect(describeDrop('personaggio', { name: 'Cesare', rarity: 'mitologico' }).rarity).toBe('mitologico')
    expect(describeDrop('opera', { name: 'Vaso', rarity: 'comune' }).rarity).toBe('comune')
  })

  it('leaves rarity undefined for drops without one (gold, exp, gemme...)', () => {
    expect(describeDrop('gold', { amount: 10 }).rarity).toBeUndefined()
    expect(describeDrop('exp', { amount: 5 }).rarity).toBeUndefined()
  })

  it('leaves rarity undefined when the raw rarity string is not a known Rarity value', () => {
    expect(describeDrop('oggetto', { itemName: 'X', rarity: 'sconosciuta' }).rarity).toBeUndefined()
  })
})
