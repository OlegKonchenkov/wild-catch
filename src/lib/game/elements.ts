import { ELEMENT_MULTIPLIERS } from '@/lib/types'
import type { Element } from '@/lib/types'

export function getElementMultiplier(attackerElement: Element, defenderElement: Element): number {
  const multipliers = ELEMENT_MULTIPLIERS[attackerElement]
  return multipliers?.[defenderElement] ?? 1.0
}
