-- Migration 055 — Premi speciali (special prizes / real-world vouchers).
--
--   special_prizes — catalogue (e.g. "Cena per due", "Tour VIP")
--   player_prizes  — a won voucher with a redemption code; admin marks redeemed

CREATE TABLE IF NOT EXISTS special_prizes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  rarity          TEXT CHECK (rarity IS NULL OR rarity IN
                    ('comune','non_comune','raro','epico','leggendario','mitologico')),
  image_url       TEXT NOT NULL DEFAULT '',
  redemption_note TEXT NOT NULL DEFAULT '',  -- instructions shown to the player on how to redeem
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_prizes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id),
  session_id           UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  prize_id             UUID NOT NULL REFERENCES special_prizes(id),
  code                 TEXT NOT NULL UNIQUE,
  won_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at          TIMESTAMPTZ,
  redeemed_by_admin_id UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_player_prizes_user_session ON player_prizes(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_player_prizes_code ON player_prizes(code);

ALTER TABLE special_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_prizes  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "special_prizes_read"  ON special_prizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "special_prizes_admin" ON special_prizes FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Player reads own vouchers; admin reads/updates all (to mark redeemed).
CREATE POLICY "player_prizes_own"   ON player_prizes FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "player_prizes_admin" ON player_prizes FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
