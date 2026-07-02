-- Migration 061 — Daily login rewards + streak (per-session, like everything else).
--
-- One row per (user, session, day). The UNIQUE constraint is the idempotency
-- backstop: double-claim attempts collide on insert (23505 → 409 to client).
-- claim_date is the Europe/Rome calendar day computed server-side.

CREATE TABLE IF NOT EXISTS player_daily_claims (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL,
  streak     INT  NOT NULL DEFAULT 1 CHECK (streak >= 1),
  reward     JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id, claim_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_claims_user_session
  ON player_daily_claims (user_id, session_id, claim_date DESC);

ALTER TABLE player_daily_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_claims_own" ON player_daily_claims FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());
