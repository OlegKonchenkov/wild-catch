-- Add attack sound fields to creatures
-- These drive the per-creature audio that plays during attack animations.

ALTER TABLE creatures
  ADD COLUMN IF NOT EXISTS attack_sound_url        TEXT,
  ADD COLUMN IF NOT EXISTS attack_sound_duration_ms INTEGER;

COMMENT ON COLUMN creatures.attack_sound_url        IS 'Public URL of the audio clip played during the attack animation';
COMMENT ON COLUMN creatures.attack_sound_duration_ms IS 'How long (ms) to play the clip before cutting it off; defaults to clip length if NULL';
