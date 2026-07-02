-- Migration 053 — Bustine (card packs): rarity-weighted random reward packs.
--
--   packs        — catalogue (permanent, like creatures/items)
--   pack_pool    — weighted possible drops for a pack (admin-editable child rows)
--   player_packs — owned, unopened packs (per-session, like player_inventory)

CREATE TABLE IF NOT EXISTS packs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rarity      TEXT CHECK (rarity IS NULL OR rarity IN
                ('comune','non_comune','raro','epico','leggendario','mitologico')),
  image_url   TEXT NOT NULL DEFAULT '',
  min_drops   INT  NOT NULL DEFAULT 3 CHECK (min_drops >= 1),
  max_drops   INT  NOT NULL DEFAULT 5 CHECK (max_drops >= min_drops),
  price_gold  INT,
  price_gemme INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pack_pool (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id        UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  reward_type    TEXT NOT NULL,
  reward_payload JSONB NOT NULL DEFAULT '{}',
  weight         INT  NOT NULL DEFAULT 1 CHECK (weight > 0),
  rarity_tier    TEXT,
  min_qty        INT  NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
  max_qty        INT  NOT NULL DEFAULT 1 CHECK (max_qty >= min_qty),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pack_pool_pack ON pack_pool(pack_id);

CREATE TABLE IF NOT EXISTS player_packs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  pack_id    UUID NOT NULL REFERENCES packs(id),
  quantity   INT  NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id, pack_id)
);
CREATE INDEX IF NOT EXISTS idx_player_packs_user_session ON player_packs(user_id, session_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE packs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_pool     ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_packs  ENABLE ROW LEVEL SECURITY;

-- Catalogue: any authenticated player may read; only admin writes.
CREATE POLICY "packs_read"      ON packs     FOR SELECT TO authenticated USING (true);
CREATE POLICY "packs_admin"     ON packs     FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "pack_pool_read"  ON pack_pool FOR SELECT TO authenticated USING (true);
CREATE POLICY "pack_pool_admin" ON pack_pool FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Owned packs: player sees/mutates own; admin sees all (mirrors player_inventory).
CREATE POLICY "player_packs_own" ON player_packs FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());
