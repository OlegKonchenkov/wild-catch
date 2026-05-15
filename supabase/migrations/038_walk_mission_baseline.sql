-- ── Walk-mission baseline ─────────────────────────────────────────────────
-- Walk-type missions track progress as the player's session step counter
-- moves forward. Up to now `player_missions.progress` was the ABSOLUTE
-- session step count clamped to the target — which meant a mission that
-- unlocked mid-session (e.g. the tutorial's 50 m walk that unlocks after
-- the boss fight) would auto-complete on its very first /position POST
-- because the player had already accumulated more than `target_count`
-- steps before the mission existed.
--
-- We capture the step counter at the moment the player_missions row is
-- first inserted (= the first /position POST after the mission unlocks)
-- so the per-mission progress is computed as
--   min(target, max(0, current_steps_walked - baseline_steps))
--
-- For PRE-EXISTING rows the column is left NULL; the position route reads
-- `baseline_steps ?? 0`, preserving the old (absolute) behaviour for any
-- mission that was mid-progress when this migration deployed. Only newly
-- inserted rows get a real baseline.
--
-- The column is nullable and lives on every player_missions row even for
-- non-walk types (cattura/qr/duel); those code paths simply don't read
-- it. We don't bother with a CHECK constraint on type — keeps the column
-- behaviour identical across types should we ever want to repurpose it.

ALTER TABLE player_missions
  ADD COLUMN baseline_steps INTEGER;

COMMENT ON COLUMN player_missions.baseline_steps IS
  'For walk-type missions: player_sessions.steps_walked at the moment '
  'this row was inserted (= effective mission unlock time). Progress is '
  'derived as min(target, current_steps - baseline_steps). NULL on rows '
  'that existed before migration 038; the application falls back to 0 '
  'for those (preserves old absolute-step behaviour).';
