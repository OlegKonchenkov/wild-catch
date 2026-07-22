import { ELEMENT_MULTIPLIERS, ALL_ELEMENTS } from '@/lib/types'
import type { Element } from '@/lib/types'

export function getElementMultiplier(attackerElement: Element, defenderElement: Element): number {
  const multipliers = ELEMENT_MULTIPLIERS[attackerElement]
  return multipliers?.[defenderElement] ?? 1.0
}

/**
 * Elements this element deals bonus damage TO (attacker advantage).
 * Derived from ELEMENT_MULTIPLIERS so display tables can never drift from
 * the combat maths — this is the single source of truth for "Forte contro".
 */
export function strongAgainst(element: Element): Element[] {
  const row = ELEMENT_MULTIPLIERS[element] ?? {}
  return ALL_ELEMENTS.filter(defender => (row[defender] ?? 1) > 1)
}

/**
 * An element that is strong against every other element (Armonia). The game
 * teaches such an element as a separate special case ("forte su tutti, nessuna
 * debolezza") rather than repeating it as a weakness on every other row, so
 * `weakAgainst` filters it out to match how guide/bestiary present the chart.
 */
function isUniversalAttacker(element: Element): boolean {
  return strongAgainst(element).length >= ALL_ELEMENTS.length - 1
}

/**
 * Elements that deal bonus damage to this element (defender disadvantage) —
 * i.e. the elements this one is "Debole contro". Inverse lookup over the
 * chart, excluding universal attackers (see above) so the per-element list
 * mirrors the 4-element cycle shown across the UI.
 */
export function weakAgainst(element: Element): Element[] {
  return ALL_ELEMENTS.filter(
    attacker =>
      attacker !== element &&
      !isUniversalAttacker(attacker) &&
      (ELEMENT_MULTIPLIERS[attacker]?.[element] ?? 1) > 1,
  )
}
