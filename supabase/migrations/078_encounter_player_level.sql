-- Persist the player's level on the encounter row.
--
-- Duels (duel/connect) and boss fights (boss/[id]) both run the player's
-- creature through scaleCombatStats(base, level, equip) — +14% HP and +10% ATK
-- per level. Wild encounters did NOT: /fight, /switch and /start used raw
-- `creature.stat + equipment` with no level term at all.
--
-- The result was a difficulty curve running backwards. selectCreatureForEncounter
-- weights rarity UP with player level (rng.ts: epico ×3 at lv10, leggendario ×5),
-- so the wild creatures a player meets get stronger as they progress while their
-- own creatures stayed frozen at base stats. Levelling up actively made the main
-- loop harder — the exact opposite of a progression system.
--
-- Storing the level on the encounter instead of re-reading player_sessions in
-- every handler:
--   * costs no extra round trip — /fight and /switch already SELECT * here;
--   * freezes the scaling for the encounter's lifetime, so a level-up landing
--     mid-fight can't resize the active creature's max HP underneath the
--     player_hp value already persisted on this row.
--
-- NULL means "started before this shipped": the handlers fall back to level 1,
-- i.e. exactly the old unscaled behaviour, so encounters in flight during the
-- deploy keep working.

ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS player_level INTEGER;

COMMENT ON COLUMN encounters.player_level IS
  'Player session level captured when the encounter started; feeds scaleCombatStats. NULL = legacy row, treated as level 1.';
