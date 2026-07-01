import { describe, expect, it } from 'vitest'
import { pickBossAbilities } from '../route'
import type { Ability } from '@/lib/game/abilities'

function ab(over: Partial<Ability> & { id: string }): Ability {
  return {
    name: over.id, description: '', element: null, category: 'attacco', rarity: null,
    power: 1, accuracy: 1, target: 'enemy', priority: 0, charge_turns: 0, recharge_turns: 0, cooldown: 0, max_uses: null,
    hits_min: 1, hits_max: 1, status_effect: null, status_chance: 0, self_status: null, heal_percent: 0, lifesteal_percent: 0,
    buff_atk: 0, buff_def: 0, debuff_atk: 0, debuff_def: 0, min_level: 1, min_rarity: null, allowed_elements: null,
    icon_url: null, animation_key: 'basic_strike', sound_url: null, color: null, ...over,
  }
}

describe('pickBossAbilities — gym-leader random moveset', () => {
  const pool: Ability[] = [
    ab({ id: 'neutral' }),                                            // any element/rarity
    ab({ id: 'fire', allowed_elements: ['fiamma'] }),                // fiamma only
    ab({ id: 'water', allowed_elements: ['adriatico'] }),            // adriatico only
    ab({ id: 'epic', min_rarity: 'epico' }),                         // needs epico+
  ]

  it('excludes abilities gated to another element', () => {
    const picks = pickBossAbilities(pool, 'fiamma', 'leggendario', 10).map(a => a.id)
    expect(picks).toContain('neutral')
    expect(picks).toContain('fire')
    expect(picks).not.toContain('water')
  })

  it('excludes abilities above the creature rarity', () => {
    const picks = pickBossAbilities(pool, 'fiamma', 'comune', 10).map(a => a.id)
    expect(picks).not.toContain('epic')
  })

  it('includes high-rarity moves for a high-rarity boss', () => {
    const picks = pickBossAbilities(pool, 'fiamma', 'mitologico', 10).map(a => a.id)
    expect(picks).toContain('epic')
  })

  it('caps the result at the requested count', () => {
    expect(pickBossAbilities(pool, 'fiamma', 'mitologico', 2)).toHaveLength(2)
  })

  it('returns nothing from an empty catalogue', () => {
    expect(pickBossAbilities([], 'fiamma', 'raro', 2)).toEqual([])
  })
})
