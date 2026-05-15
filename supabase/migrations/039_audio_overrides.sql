-- Migration 039 — Admin-managed audio overrides
--
-- Lets admins replace the default in-game music for 5 slots with an uploaded
-- mp3 (or other audio file). When an override row is present AND enabled,
-- the client plays that file in loop instead of the procedural Web Audio
-- synth. When removed/disabled, playback falls back to the default synth
-- (or, for the intro slot, to silence).
--
-- Scope rules:
--   session_id = uuid  -> override applies only to that session
--   session_id = NULL  -> global override; per-session row wins if both exist
--
-- Slots:
--   map       -> map ambience (default: forest pentatonic loop)
--   encounter -> wild encounter battle music
--   duel      -> PvP duel music
--   boss      -> boss fight music
--   intro     -> onboarding/tutorial intro carousel (default: silence)

CREATE TABLE IF NOT EXISTS audio_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES sessions(id) ON DELETE CASCADE,  -- NULL = global
  slot        text NOT NULL CHECK (slot IN ('map','encounter','duel','boss','intro')),
  file_url    text NOT NULL,
  file_name   text,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per (session, slot). NULL session_id needs a partial unique index
-- because Postgres treats NULLs as distinct in standard UNIQUE constraints.
CREATE UNIQUE INDEX IF NOT EXISTS audio_overrides_session_slot_uniq
  ON audio_overrides (session_id, slot)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS audio_overrides_global_slot_uniq
  ON audio_overrides (slot)
  WHERE session_id IS NULL;

-- Fast slot+session lookup at playback time
CREATE INDEX IF NOT EXISTS audio_overrides_slot_idx
  ON audio_overrides (slot, session_id);

ALTER TABLE audio_overrides ENABLE ROW LEVEL SECURITY;

-- Admins: full read/write
CREATE POLICY audio_overrides_admin_all ON audio_overrides
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Players: read only enabled rows (they need to know which file to play).
-- We intentionally do NOT filter by session_id here — clients may need both
-- the global fallback and the per-session row to apply the correct precedence.
CREATE POLICY audio_overrides_player_read ON audio_overrides
  FOR SELECT
  USING (enabled = true);

-- Keep updated_at fresh on UPDATE
CREATE OR REPLACE FUNCTION touch_audio_overrides_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audio_overrides_touch
  BEFORE UPDATE ON audio_overrides
  FOR EACH ROW EXECUTE FUNCTION touch_audio_overrides_updated_at();

COMMENT ON TABLE audio_overrides IS
  'Admin-uploaded audio that replaces the default in-game synth for a given '
  'slot. session_id NULL = global; per-session row wins over global when both exist.';
