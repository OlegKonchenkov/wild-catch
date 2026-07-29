-- Fleeing an encounter now costs a short cooldown before the next one can spawn.
--
-- /api/game/encounter/flee used to just mark the row 'fled' and return ok:
-- no cost, no penalty, no cooldown. Combined with the fact that creature HP is
-- restored at the start of every encounter, that made "flee" a free reroll —
-- the optimal play against any creature you didn't want was to bail instantly
-- and spin again, which is also the fastest way to farm for rare spawns.
--
-- The penalty is deliberately TIME, not HP or gold. HP doesn't persist between
-- encounters yet, so a parting shot would cost literally nothing; and in a
-- timed event the scarce resource the player actually feels is the clock.
--
-- Blocking the encounter roll (not the fight) means running away from a fight
-- you can't win is still a legitimate move — it just isn't free rerolling.

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS encounter_block_until TIMESTAMPTZ;

COMMENT ON COLUMN player_sessions.encounter_block_until IS
  'Set when the player flees an encounter; until it passes, /position will not trigger a new encounter and /encounter/start refuses. NULL = no block.';
