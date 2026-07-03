-- Migration 071 — Scambi di doppioni tra amici (Wave 3).
--
-- Regole: stessa sessione, solo tra amici, solo DOPPIONI (chi cede resta
-- sempre con >= 1 copia). L'accettazione è atomica via RPC execute_trade:
-- ogni guardia violata solleva eccezione e la transazione non tocca nulla.

CREATE TABLE IF NOT EXISTS trades (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  proposer_id           UUID NOT NULL REFERENCES auth.users(id),
  recipient_id          UUID NOT NULL REFERENCES auth.users(id),
  proposer_creature_id  UUID NOT NULL REFERENCES creatures(id),
  recipient_creature_id UUID NOT NULL REFERENCES creatures(id),
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at          TIMESTAMPTZ,
  CHECK (proposer_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_trades_recipient ON trades (recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_proposer  ON trades (proposer_id, status);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades_select" ON trades FOR SELECT TO authenticated
  USING (proposer_id = auth.uid() OR recipient_id = auth.uid() OR is_admin());
-- Scritture solo via API (service role): niente insert/update client.

-- ── RPC atomica di esecuzione ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION execute_trade(p_trade_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  t             trades%ROWTYPE;
  v_prop_row    player_creatures%ROWTYPE;
  v_rec_row     player_creatures%ROWTYPE;
BEGIN
  SELECT * INTO t FROM trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'trade_not_found'; END IF;
  IF t.status <> 'pending' THEN RAISE EXCEPTION 'trade_not_pending'; END IF;
  IF t.recipient_id <> p_user_id THEN RAISE EXCEPTION 'not_recipient'; END IF;

  -- Il proponente cede un DOPPIONE della sua creatura offerta
  SELECT * INTO v_prop_row FROM player_creatures
   WHERE user_id = t.proposer_id AND session_id = t.session_id
     AND creature_id = t.proposer_creature_id FOR UPDATE;
  IF NOT FOUND OR v_prop_row.duplicates_count < 2 THEN
    RAISE EXCEPTION 'proposer_missing_duplicate';
  END IF;

  -- Il destinatario cede un DOPPIONE della creatura richiesta
  SELECT * INTO v_rec_row FROM player_creatures
   WHERE user_id = t.recipient_id AND session_id = t.session_id
     AND creature_id = t.recipient_creature_id FOR UPDATE;
  IF NOT FOUND OR v_rec_row.duplicates_count < 2 THEN
    RAISE EXCEPTION 'recipient_missing_duplicate';
  END IF;

  -- Swap: −1 a chi cede, +1 (o insert) a chi riceve, per entrambe le creature
  UPDATE player_creatures SET duplicates_count = duplicates_count - 1 WHERE id = v_prop_row.id;
  UPDATE player_creatures SET duplicates_count = duplicates_count - 1 WHERE id = v_rec_row.id;

  INSERT INTO player_creatures (user_id, session_id, creature_id, duplicates_count)
  VALUES (t.recipient_id, t.session_id, t.proposer_creature_id, 1)
  ON CONFLICT (user_id, session_id, creature_id)
  DO UPDATE SET duplicates_count = player_creatures.duplicates_count + 1;

  INSERT INTO player_creatures (user_id, session_id, creature_id, duplicates_count)
  VALUES (t.proposer_id, t.session_id, t.recipient_creature_id, 1)
  ON CONFLICT (user_id, session_id, creature_id)
  DO UPDATE SET duplicates_count = player_creatures.duplicates_count + 1;

  UPDATE trades SET status = 'accepted', responded_at = now() WHERE id = p_trade_id;
END;
$$;
