-- Add pin_id to boss_fights for map-pin–based boss encounters.
-- Nullable so existing QR-code fights are unaffected.
ALTER TABLE boss_fights
  ADD COLUMN IF NOT EXISTS pin_id UUID REFERENCES session_map_pins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boss_fights_pin_user
  ON boss_fights (pin_id, user_id);
