-- Migration 067 — Capipalestra presidiabili (Wave 2 / Territorio Vivo).
--
-- Un pin boss con payload.gym=true è una "palestra": chi la vince la presidia.
-- Tutti la vedono (select) ma scrive solo il service role (route boss/claim).
-- Il decadimento della difesa e la rendita sono calcolati a runtime da
-- held_since — nessun cron.

CREATE TABLE IF NOT EXISTS gym_holds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id          UUID NOT NULL REFERENCES session_map_pins(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  holder_id       UUID NOT NULL REFERENCES auth.users(id),
  held_since      TIMESTAMPTZ NOT NULL DEFAULT now(),
  times_defended  INT NOT NULL DEFAULT 0,
  UNIQUE (pin_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_gym_holds_session ON gym_holds (session_id);

ALTER TABLE gym_holds ENABLE ROW LEVEL SECURITY;
-- Tutti i giocatori autenticati vedono chi presidia; nessuna scrittura client.
CREATE POLICY "gym_holds_read" ON gym_holds FOR SELECT TO authenticated USING (true);
