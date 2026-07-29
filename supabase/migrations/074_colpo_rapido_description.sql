-- "Colpo Rapido" claimed a mechanic the game does not have.
--
-- Seeded in 050_abilities_seed.sql as:
--   'Un attacco fulmineo che colpisce sempre per primo.'  (power 0.7, priority 1)
--
-- Nothing has ever read `abilities.priority` — not encounter/fight, not
-- duel/action, not boss/[id]. Turn order isn't a contest in any of them: the
-- player acts, then the opponent answers. So "colpisce sempre per primo" was
-- true of every ability and specific to none, and this is the FIRST special
-- move the game hands the player (tutorial mission M4, see lib/game/tutorial.ts).
--
-- The ⚡ Priorità chip and the admin "Priorità" field are removed in the same
-- change. The column itself is kept, values intact, so a future turn-order
-- rework can adopt the authoring intent that's already encoded in the seed.
--
-- Not addressed here: at power 0.7 this ability still deals less damage than
-- the plain ATTACCA button, because base attacks skip the DEF mitigation that
-- abilities go through (rng.ts:calculateFightDamage vs combat.ts:calculateCombatDamage).
-- That asymmetry affects 13 of the 29 attack abilities and is a balance pass of
-- its own — fixing it by nudging this one power value would just move the
-- problem. This migration only stops the description from lying.

UPDATE abilities
SET description = 'Un attacco rapido e leggero, sempre pronto: nessuna ricarica, nessun tempo di carica.'
WHERE name = 'Colpo Rapido'
  AND description = 'Un attacco fulmineo che colpisce sempre per primo.';
