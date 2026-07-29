-- Align the Esca's description with what it actually does now.
--
-- The item had two different promises and delivered neither, because nothing
-- ever read `player_sessions.esca_active_until`:
--   * /api/game/item/use replied  "Creature più frequenti per 10 minuti."
--   * the tutorial item said      "Attira creature più rare per 10 minuti."
--
-- The implemented effect (lib/game/step-counter.ts:encounterChance) raises the
-- per-fix encounter probability from 0.30 to 0.55 for the 10-minute window —
-- i.e. FREQUENCY, not rarity. Rarity weighting lives in the encounter/start RNG
-- and is a separate change; until then the copy must not promise it.

UPDATE items
SET description = 'L''eredità del maestro: una semplice esca artigianale. Attira creature molto più spesso per 10 minuti.'
WHERE type = 'esca'
  AND description = 'L''eredità del maestro: una semplice esca artigianale. Attira creature più rare per 10 minuti.';

-- Any other esca authored with a "più rare" promise gets the same treatment.
UPDATE items
SET description = regexp_replace(description, 'creature più rare', 'creature molto più spesso', 'gi')
WHERE type = 'esca'
  AND description ILIKE '%creature più rare%';
