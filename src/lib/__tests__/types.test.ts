import { describe, it, expect } from 'vitest'
import type { Creature, Session, PlayerSession } from '@/lib/types'

describe('types', () => {
  it('Creature type has required fields', () => {
    const c: Creature = {
      id: 'uuid', name: 'Fiammare', description: 'desc',
      element: 'fiamma', rarity: 'comune', hp: 60, atk: 40, def: 30,
      min_level: 1, image_url: '', sprite_url: '', lottie_url: null,
      spawn_weight: 10, evolution_of: null,
    }
    expect(c.element).toBe('fiamma')
  })

  it('Session status enum is valid', () => {
    const statuses: Session['status'][] = ['draft', 'ready', 'active', 'ended']
    expect(statuses).toHaveLength(4)
  })
})
