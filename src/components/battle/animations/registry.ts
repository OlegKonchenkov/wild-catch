import type { AttackAnimationComponent } from './types'
import FiammaAttack    from './fiamma'
import AdriaticoAttack from './adriatico'
import BoscoAttack     from './bosco'
import TerraAttack     from './terra'
import ArmoniaAttack   from './armonia'

const REGISTRY: Record<string, AttackAnimationComponent> = {
  fiamma:    FiammaAttack,
  adriatico: AdriaticoAttack,
  bosco:     BoscoAttack,
  terra:     TerraAttack,
  armonia:   ArmoniaAttack,
}

/** Returns the animation component for a given element slug.
 *  Falls back to ArmoniaAttack for unknown elements. */
export function getAttackAnimation(element: string): AttackAnimationComponent {
  return REGISTRY[element] ?? ArmoniaAttack
}
