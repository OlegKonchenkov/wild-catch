-- Migration 066 — Pergamene (Wave 2 / Territorio Vivo).
--
-- Camminare produce pergamene (1 ogni 250 passi, senza cron: il crossing è
-- calcolato nel position route). Si aprono dallo Zaino e rivelano un aneddoto
-- casuale + gemme, alimentando Collezione e Quiz (gate aneddoto).

CREATE TABLE IF NOT EXISTS player_pergamene (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  steps_at   INT NOT NULL DEFAULT 0,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pergamene_user_session
  ON player_pergamene (user_id, session_id, opened_at);

ALTER TABLE player_pergamene ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pergamene_own" ON player_pergamene FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());
