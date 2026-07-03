-- Migration 062 — Recurring missions (daily / weekly / monthly), no cron.
--
-- Progress rows are keyed by a computed period_key ('' for one-shot missions,
-- '2026-07-02' daily, '2026-W27' weekly, '2026-07' monthly — Europe/Rome).
-- A new period simply reads/writes a fresh row; old rows remain as history.
-- Existing rows keep period_key = '' so nothing changes for one-shot missions.

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS recurrence TEXT
    CHECK (recurrence IS NULL OR recurrence IN ('daily','weekly','monthly'));

ALTER TABLE player_missions
  ADD COLUMN IF NOT EXISTS period_key TEXT NOT NULL DEFAULT '';

-- Widen the uniqueness so each period gets its own progress row.
-- (027 created player_missions_user_mission_session_uniq on user/mission/session.)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_missions_user_mission_session_uniq') THEN
    ALTER TABLE player_missions DROP CONSTRAINT player_missions_user_mission_session_uniq;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_missions_user_mission_session_period_uniq') THEN
    ALTER TABLE player_missions
      ADD CONSTRAINT player_missions_user_mission_session_period_uniq
      UNIQUE NULLS NOT DISTINCT (user_id, mission_id, session_id, period_key);
  END IF;
END $$;
