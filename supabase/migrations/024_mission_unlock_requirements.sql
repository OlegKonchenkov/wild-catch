-- Mission unlock requirements
-- NULL requirements preserve existing behavior: missions are visible and active immediately.

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS unlock_level INTEGER CHECK (unlock_level IS NULL OR unlock_level >= 1),
  ADD COLUMN IF NOT EXISTS unlock_after_mission_id UUID REFERENCES missions(id) ON DELETE SET NULL;

