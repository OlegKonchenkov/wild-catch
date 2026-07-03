-- Migration 065 — Guardiani del luogo (Wave 2 / Territorio Vivo).
--
-- Un pin boss può "custodire" un luogo culturale: sconfiggerlo libera il luogo
-- per quel giocatore, erogando il bonus del luogo (unlock_bonus, via dispenser).

ALTER TABLE session_map_pins
  ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES cultural_places(id) ON DELETE SET NULL;

ALTER TABLE cultural_places
  ADD COLUMN IF NOT EXISTS unlock_bonus JSONB;   -- array [{type,payload}] · null = nessun bonus

CREATE TABLE IF NOT EXISTS player_place_unlocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  place_id    UUID NOT NULL REFERENCES cultural_places(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id, place_id)
);
CREATE INDEX IF NOT EXISTS idx_place_unlocks_user_session
  ON player_place_unlocks (user_id, session_id);

ALTER TABLE player_place_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_unlocks_own" ON player_place_unlocks FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());
