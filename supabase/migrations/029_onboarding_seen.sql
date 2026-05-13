-- Per-session onboarding flag.
-- Default false so every new join shows the intro carousel; users who already
-- know the game can hit "Salta" and it gets set to true for that session only
-- (different sessions can have different rules/creatures, so we re-intro by
-- design).

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS onboarding_seen boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN player_sessions.onboarding_seen IS
  'True once the player has either completed or skipped the onboarding carousel for this session.';
