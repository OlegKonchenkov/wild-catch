-- Make level-up rewards actually reach the player.
--
-- `level_rewards` has a full admin CRUD (src/app/admin/level-rewards + the API
-- route) and appears in the generated types, but like creatures.session_id it
-- was created through Supabase Studio and never captured in a migration. More
-- importantly: NO GAME ENDPOINT HAS EVER READ IT. An organiser could configure
-- "level 5 → 200 gold + a Rete" and the player would receive exactly the
-- 15 + random(26) gold that increment_player_stats hands out (see 052), and
-- nothing else. Every level reward ever authored was silently discarded.
--
-- Part 1 recreates the table so a rebuilt database matches production.
-- Part 2 adds the ledger the delivery code needs.

-- ── 1. level_rewards (retroactive) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level INTEGER NOT NULL UNIQUE CHECK (level >= 1),
  gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  -- Legacy single-item columns; `bonus_items` is the source of truth and the
  -- admin route keeps these two in sync with its first entry.
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  item_qty INTEGER NOT NULL DEFAULT 1 CHECK (item_qty >= 1),
  -- [{ item_id, quantity }, …]
  bonus_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE level_rewards ENABLE ROW LEVEL SECURITY;

-- Read-only catalogue for players (it's what the level-up modal describes);
-- writes stay admin-only through the service-role admin client.
DROP POLICY IF EXISTS level_rewards_read ON level_rewards;
CREATE POLICY level_rewards_read ON level_rewards
  FOR SELECT TO authenticated USING (TRUE);

-- ── 2. Delivery ledger ──────────────────────────────────────────────────────
-- One row per (player, session, level) actually paid out. This is what makes
-- delivery idempotent and self-healing:
--   * a single XP award can cross several levels at once — the ledger lets us
--     pay every level crossed, not just the final one;
--   * retries / concurrent awards can't double-pay (unique constraint);
--   * players who levelled up BEFORE this shipped get their back-rewards on
--     their next level-up check, instead of losing them forever.
CREATE TABLE IF NOT EXISTS player_level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level >= 1),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_id, level)
);

CREATE INDEX IF NOT EXISTS idx_player_level_rewards_lookup
  ON player_level_rewards (user_id, session_id);

ALTER TABLE player_level_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_level_rewards_read ON player_level_rewards;
CREATE POLICY player_level_rewards_read ON player_level_rewards
  FOR SELECT TO authenticated USING (user_id = auth.uid());

COMMENT ON TABLE player_level_rewards IS
  'Ledger of level_rewards already paid out, per player per session. Claim-before-grant makes delivery at-most-once.';
