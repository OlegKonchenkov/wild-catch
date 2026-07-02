/**
 * Key gating for chests (forzieri). A chest lists key requirements — each an
 * item id plus a quantity — and may require several keys and/or several key
 * types. `checkKeyRequirements` reports whether the player's inventory covers
 * all of them, and which are short.
 */

export interface KeyRequirement {
  item_id: string
  qty: number
}

export interface MissingKey {
  item_id: string
  needed: number
  have: number
}

export interface KeyCheck {
  ok: boolean
  missing: MissingKey[]
}

/**
 * @param requirements chest.key_requirements
 * @param owned map of item_id → quantity the player currently holds
 */
export function checkKeyRequirements(
  requirements: KeyRequirement[],
  owned: Record<string, number>,
): KeyCheck {
  const missing: MissingKey[] = []
  for (const req of requirements ?? []) {
    const needed = Math.max(1, Number(req.qty) || 1)
    const have = owned[req.item_id] ?? 0
    if (have < needed) missing.push({ item_id: req.item_id, needed, have })
  }
  return { ok: missing.length === 0, missing }
}
