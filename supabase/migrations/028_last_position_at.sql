-- Track timestamp of the most recently persisted GPS fix per player_session.
-- Needed by /api/game/position to compute velocity and reject fixes that imply
-- impossible walking speeds (i.e. GPS spikes or vehicle movement).

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS last_position_at timestamptz;

COMMENT ON COLUMN player_sessions.last_position_at IS
  'When last_position was last written. Used to compute implied velocity and filter GPS noise/spikes.';
