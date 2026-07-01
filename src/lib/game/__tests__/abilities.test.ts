import { describe, expect, it } from 'vitest'
import {
  canLearnAbility,
  isAbilityUsable,
  resolveAbilityCast,
  tickAbilityState,
  applyStatMods,
  addSelfBuffs,
  addEnemyDebuffs,
  emptyAbilityState,
  normalizeAbilityState,
  type Ability,
  type AbilityBattleState,
} from '@/lib/game/abilities'

// A neutral, minimal ability; override per test.
function makeAbility(over: Partial<Ability> = {}): Ability {
  return {
    id: 'ab-1', name: 'Test', description: '', element: null, category: 'attacco', rarity: null,
    power: 1, accuracy: 1, target: 'enemy', priority: 0,
    charge_turns: 0, recharge_turns: 0, cooldown: 0, max_uses: null,
    hits_min: 1, hits_max: 1,
    status_effect: null, status_chance: 0, self_status: null,
    heal_percent: 0, lifesteal_percent: 0,
    buff_atk: 0, buff_def: 0, debuff_atk: 0, debuff_def: 0,
    min_level: 1, min_rarity: null, allowed_elements: null,
    icon_url: null, animation_key: 'basic_strike', sound_url: null, color: null,
    ...over,
  }
}

function baseCast(ability: Ability, over: Partial<Parameters<typeof resolveAbilityCast>[0]> = {}) {
  return {
    ability,
    casterElement: 'fiamma' as const,
    targetElement: 'fiamma' as const,
    casterAtk: 100, casterDef: 50, casterMaxHp: 200, casterHp: 120,
    targetDef: 50,
    state: emptyAbilityState(),
    rng: () => 0.99, // high roll: never crits, never misses (accuracy 1), min multi-hit
    ...over,
  }
}

describe('canLearnAbility', () => {
  const ability = { min_level: 20, min_rarity: 'raro' as const, allowed_elements: ['fiamma'] }

  it('fails without the token', () => {
    expect(canLearnAbility({ ability, element: 'fiamma', rarity: 'raro', playerLevel: 30, ownsToken: false }).ok).toBe(false)
  })
  it('fails below the level gate', () => {
    const r = canLearnAbility({ ability, element: 'fiamma', rarity: 'raro', playerLevel: 10, ownsToken: true })
    expect(r.ok).toBe(false); expect(r.reason).toContain('Lv. 20')
  })
  it('fails on wrong element', () => {
    const r = canLearnAbility({ ability, element: 'bosco', rarity: 'raro', playerLevel: 30, ownsToken: true })
    expect(r.ok).toBe(false); expect(r.reason).toContain('Fiamma')
  })
  it('fails below the rarity gate', () => {
    const r = canLearnAbility({ ability, element: 'fiamma', rarity: 'comune', playerLevel: 30, ownsToken: true })
    expect(r.ok).toBe(false)
  })
  it('passes when every gate is satisfied', () => {
    expect(canLearnAbility({ ability, element: 'fiamma', rarity: 'epico', playerLevel: 30, ownsToken: true }).ok).toBe(true)
  })
  it('null gates allow any element/rarity', () => {
    const open = { min_level: 1, min_rarity: null, allowed_elements: null }
    expect(canLearnAbility({ ability: open, element: 'terra', rarity: 'comune', playerLevel: 1, ownsToken: true }).ok).toBe(true)
  })
})

describe('isAbilityUsable', () => {
  it('blocks while on cooldown', () => {
    const ab = makeAbility({ id: 'x', cooldown: 3 })
    const state: AbilityBattleState = { ...emptyAbilityState(), cooldowns: { x: 2 } }
    expect(isAbilityUsable(ab, state).usable).toBe(false)
  })
  it('blocks when PP exhausted', () => {
    const ab = makeAbility({ id: 'x', max_uses: 2 })
    const state: AbilityBattleState = { ...emptyAbilityState(), usesLeft: { x: 0 } }
    expect(isAbilityUsable(ab, state).usable).toBe(false)
  })
  it('allows a fresh ability', () => {
    expect(isAbilityUsable(makeAbility(), emptyAbilityState()).usable).toBe(true)
  })
})

describe('resolveAbilityCast — damage', () => {
  it('deals damage scaled by power', () => {
    const weak = resolveAbilityCast(baseCast(makeAbility({ power: 1 })))
    const strong = resolveAbilityCast(baseCast(makeAbility({ power: 2 })))
    expect(weak.phase).toBe('fired')
    expect(strong.totalDamage).toBeGreaterThan(weak.totalDamage)
  })

  it('applies element advantage (fiamma → bosco ×1.5)', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ power: 1 }), { casterElement: 'fiamma', targetElement: 'bosco' }))
    expect(r.elementMultiplier).toBe(1.5)
  })

  it('multi-hit produces multiple hits', () => {
    // rng 0.99 → rollHits returns hits_max side; use a mid rng to land inside range
    const r = resolveAbilityCast(baseCast(makeAbility({ hits_min: 2, hits_max: 2, power: 0.5 }), { rng: () => 0.5 }))
    expect(r.hits).toBe(2)
    expect(r.damagePerHit).toHaveLength(2)
  })

  it('misses when accuracy roll fails', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ accuracy: 0.5 }), { rng: () => 0.9 }))
    expect(r.missed).toBe(true)
    expect(r.totalDamage).toBe(0)
  })

  it('a self-target buff move deals no damage', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ target: 'self', power: 0, buff_atk: 0.3 })))
    expect(r.totalDamage).toBe(0)
    expect(r.buffs.atk).toBe(0.3)
  })
})

describe('resolveAbilityCast — heal & lifesteal', () => {
  it('heal_percent restores caster HP', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ target: 'self', power: 0, heal_percent: 0.25 }), { casterMaxHp: 200 }))
    expect(r.healToCaster).toBe(50)
  })
  it('lifesteal heals a fraction of damage dealt', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ power: 1, lifesteal_percent: 0.5 })))
    expect(r.healToCaster).toBe(Math.max(1, Math.round(r.totalDamage * 0.5)))
  })
})

describe('resolveAbilityCast — status', () => {
  it('inflicts status when the chance roll succeeds', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ status_effect: 'scottatura', status_chance: 1 }), { rng: () => 0.0 }))
    expect(r.statusToTarget).toBe('scottatura')
  })
  it('does not inflict status when the roll fails', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ status_effect: 'scottatura', status_chance: 0.1 }), { rng: () => 0.9 }))
    expect(r.statusToTarget).toBeNull()
  })
  it('applies self_status deterministically', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ target: 'self', power: 0, self_status: 'rigenerazione' })))
    expect(r.selfStatus).toBe('rigenerazione')
  })
})

describe('resolveAbilityCast — cooldown / PP / recharge', () => {
  it('sets the cooldown after firing', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ id: 'cd', cooldown: 3 })))
    expect(r.nextState.cooldowns.cd).toBe(3)
  })
  it('blocks a cast while cooling down (no state change)', () => {
    const ab = makeAbility({ id: 'cd', cooldown: 3 })
    const r = resolveAbilityCast(baseCast(ab, { state: { ...emptyAbilityState(), cooldowns: { cd: 2 } } }))
    expect(r.phase).toBe('blocked')
    expect(r.totalDamage).toBe(0)
  })
  it('decrements PP on use', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ id: 'pp', max_uses: 2 })))
    expect(r.nextState.usesLeft.pp).toBe(1)
  })
  it('sets recharge after a recharge move', () => {
    const r = resolveAbilityCast(baseCast(makeAbility({ id: 'nuke', recharge_turns: 1, power: 3 })))
    expect(r.nextState.recharge).toBe(1)
  })
})

describe('resolveAbilityCast — charge (two-turn)', () => {
  it('first cast charges (no damage), second cast fires', () => {
    const ability = makeAbility({ id: 'beam', charge_turns: 1, power: 3 })
    const first = resolveAbilityCast(baseCast(ability))
    expect(first.phase).toBe('charging')
    expect(first.totalDamage).toBe(0)
    expect(first.nextState.pending?.abilityId).toBe('beam')

    const second = resolveAbilityCast(baseCast(ability, { state: first.nextState }))
    expect(second.phase).toBe('fired')
    expect(second.totalDamage).toBeGreaterThan(0)
    expect(second.nextState.pending).toBeNull()
  })
})

describe('tickAbilityState', () => {
  it('decrements cooldowns and drops zeros', () => {
    const { state } = tickAbilityState({ ...emptyAbilityState(), cooldowns: { a: 2, b: 1 } })
    expect(state.cooldowns.a).toBe(1)
    expect(state.cooldowns.b).toBeUndefined()
  })
  it('reports recharging and consumes a recharge turn', () => {
    const { state, recharging } = tickAbilityState({ ...emptyAbilityState(), recharge: 1 })
    expect(recharging).toBe(true)
    expect(state.recharge).toBe(0)
  })
})

describe('stat mods', () => {
  it('applyStatMods scales atk/def by the mods', () => {
    const s: AbilityBattleState = { ...emptyAbilityState(), atkMod: 0.5, defMod: -0.2 }
    expect(applyStatMods(100, 50, s)).toEqual({ atk: 150, def: 40 })
  })
  it('addSelfBuffs raises the caster mods; addEnemyDebuffs lowers the target mods', () => {
    const buffed = addSelfBuffs(emptyAbilityState(), { atk: 0.3, def: 0.1 })
    expect(buffed.atkMod).toBeCloseTo(0.3)
    const debuffed = addEnemyDebuffs(emptyAbilityState(), { atk: 0.25, def: 0 })
    expect(debuffed.atkMod).toBeCloseTo(-0.25)
  })
})

describe('normalizeAbilityState', () => {
  it('coerces null/garbage into a clean state', () => {
    expect(normalizeAbilityState(null)).toEqual(emptyAbilityState())
    const s = normalizeAbilityState({ cooldowns: { a: '3' }, recharge: '2', pending: { abilityId: 'x', chargeTurnsLeft: '1' } })
    expect(s.cooldowns.a).toBe(3)
    expect(s.recharge).toBe(2)
    expect(s.pending).toEqual({ abilityId: 'x', chargeTurnsLeft: 1 })
  })
})
