import { ELEMENT_MULTIPLIERS } from '@/lib/types'
import type { Element } from '@/lib/types'

export function getElementMultiplier(attackerElement: Element, defenderElement: Element): number {
  if (attackerElement === 'armonia') return 1.15  // +15% vs all

  const multipliers = ELEMENT_MULTIPLIERS[attackerElement]
  return multipliers[defenderElement] ?? 1.0
}
