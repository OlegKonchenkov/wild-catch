-- Migration 054 — Forzieri (chests) + Chiavi (keys).
--
-- Chests are DETERMINISTIC (contents identical for everyone) and gated behind
-- keys. A key is just an item of the new type 'chiave'. A chest may require
-- several keys and/or several key types (key_requirements is a list).
--
--   chests        — catalogue (fixed contents + key requirements)
--   player_chests — owned, unopened chests (per-session)

-- ── 1. Add 'chiave' to the item type constraint (mirrors migration 040) ──────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_type_check') THEN
    ALTER TABLE items DROP CONSTRAINT items_type_check;
  END IF;
  ALTER TABLE items
    ADD CONSTRAINT items_type_check
    CHECK (type IN (
      'rete','esca','uovo','battaglia','pozione','cura','custom','chiave',
      'arma','corazza','elmo','accessorio'
    ));
END $$;

-- ── 2. chests catalogue ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  rarity           TEXT CHECK (rarity IS NULL OR rarity IN
                     ('comune','non_comune','raro','epico','leggendario','mitologico')),
  image_url        TEXT NOT NULL DEFAULT '',
  place_id         UUID,   -- optional link to a cultural place (FK added in migration 058)
  key_requirements JSONB NOT NULL DEFAULT '[]',  -- [{ item_id, qty }]
  contents         JSONB NOT NULL DEFAULT '[]',  -- [{ type, payload }]
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_chests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  chest_id   UUID NOT NULL REFERENCES chests(id),
  quantity   INT  NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id, chest_id)
);
CREATE INDEX IF NOT EXISTS idx_player_chests_user_session ON player_chests(user_id, session_id);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE chests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_chests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chests_read"  ON chests FOR SELECT TO authenticated USING (true);
CREATE POLICY "chests_admin" ON chests FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "player_chests_own" ON player_chests FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());
