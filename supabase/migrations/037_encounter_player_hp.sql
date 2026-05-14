-- Migration 037 — Server-side encounter player HP (anti-cheat)
--
-- Before this migration the encounter screens trusted the client to
-- send `currentPlayerHp` on every fight / heal / switch action, with
-- the server only clamping to creature.hp. A malicious client could
-- send currentPlayerHp = maxHp every turn and be effectively immortal
-- in wild encounters.
--
-- We now persist the active creature's HP on the encounter row.
-- Routes will:
--   start:  set player_hp = creature.hp (full)
--   fight:  read player_hp, apply damage, persist new player_hp
--   heal:   read player_hp, add healAmount clamped to maxHp, persist
--   switch: reset player_hp to incoming creature's max (defensive — we
--           don't yet track per-slot HP, so switching gives a clean HP
--           to the incoming creature; legitimate since the client knew
--           it was switching in a fresh one anyway)
--
-- NULL = legacy in-flight encounters that predate this migration.
-- Routes fall back to the old client-trust path when player_hp IS NULL,
-- so no current encounter gets stuck.

ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS player_hp INTEGER;

COMMENT ON COLUMN encounters.player_hp IS
  'Authoritative HP of the active player creature in this encounter. '
  'NULL on rows created before migration 037 (legacy client-trust path).';
