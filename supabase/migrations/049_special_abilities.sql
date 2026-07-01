-- Migration 049 — Special Abilities (Abilità Speciali)
--
-- Additive only. Mirrors the Equipment pattern (migration 040):
--   • abilities            — species-level catalogue (like creatures/items)
--   • player_abilities     — owned tokens (like player_inventory)
--   • creature_abilities   — learned moveset bound to a player_creatures instance
--   • ability_state JSONB  — per-battle cooldown/charge/PP state on encounters + duel_lineups
-- Plus: 4 new status effects, missions.reward_ability_id, qr_codes 'abilita' type.
--
-- A Daimon with zero learned abilities behaves exactly as before this migration.

-- ── 1. abilities catalogue ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- null element = neutral (usable by any element, subject to allowed_elements)
  element TEXT CHECK (element IS NULL OR element IN ('fiamma','adriatico','bosco','terra','armonia')),
  category TEXT NOT NULL DEFAULT 'attacco'
    CHECK (category IN ('attacco','stato','cura','potenziamento','difesa')),
  rarity TEXT CHECK (rarity IS NULL OR rarity IN ('comune','non_comune','raro','epico','leggendario','mitologico')),

  -- Effect
  power NUMERIC NOT NULL DEFAULT 0 CHECK (power >= 0),          -- damage multiplier, 0 = non-damaging
  accuracy NUMERIC NOT NULL DEFAULT 1 CHECK (accuracy BETWEEN 0 AND 1),
  target TEXT NOT NULL DEFAULT 'enemy' CHECK (target IN ('enemy','self')),
  priority INTEGER NOT NULL DEFAULT 0,

  -- Multi-turn / economy
  charge_turns INTEGER NOT NULL DEFAULT 0 CHECK (charge_turns >= 0),
  recharge_turns INTEGER NOT NULL DEFAULT 0 CHECK (recharge_turns >= 0),
  cooldown INTEGER NOT NULL DEFAULT 0 CHECK (cooldown >= 0),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),   -- PP per battle, null = unlimited
  hits_min INTEGER NOT NULL DEFAULT 1 CHECK (hits_min >= 1),
  hits_max INTEGER NOT NULL DEFAULT 1 CHECK (hits_max >= 1),

  -- Status / heal / buff
  status_effect TEXT CHECK (status_effect IS NULL OR status_effect IN
    ('paralisi','confusione','sonno','veleno','scottatura','congelamento','rigenerazione','marchio')),
  status_chance NUMERIC NOT NULL DEFAULT 0 CHECK (status_chance BETWEEN 0 AND 1),
  self_status TEXT CHECK (self_status IS NULL OR self_status IN
    ('paralisi','confusione','sonno','veleno','scottatura','congelamento','rigenerazione','marchio')),
  heal_percent NUMERIC NOT NULL DEFAULT 0 CHECK (heal_percent BETWEEN 0 AND 1),
  lifesteal_percent NUMERIC NOT NULL DEFAULT 0 CHECK (lifesteal_percent BETWEEN 0 AND 1),
  buff_atk NUMERIC NOT NULL DEFAULT 0,
  buff_def NUMERIC NOT NULL DEFAULT 0,
  debuff_atk NUMERIC NOT NULL DEFAULT 0,
  debuff_def NUMERIC NOT NULL DEFAULT 0,

  -- Learn gates
  min_level INTEGER NOT NULL DEFAULT 1 CHECK (min_level >= 1),
  min_rarity TEXT CHECK (min_rarity IS NULL OR min_rarity IN
    ('comune','non_comune','raro','epico','leggendario','mitologico')),
  allowed_elements TEXT[],   -- null = any element may learn

  -- Presentation
  icon_url TEXT,
  animation_key TEXT NOT NULL DEFAULT 'basic_strike',
  sound_url TEXT,
  color TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (hits_max >= hits_min)
);

-- ── 2. player_abilities (owned tokens) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ability_id UUID NOT NULL REFERENCES abilities(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  obtained_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id, ability_id)
);
CREATE INDEX IF NOT EXISTS idx_player_abilities_user_session ON player_abilities(user_id, session_id);

-- ── 3. creature_abilities (learned moveset, ≤4 per creature) ───────────────
CREATE TABLE IF NOT EXISTS creature_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_creature_id UUID NOT NULL REFERENCES player_creatures(id) ON DELETE CASCADE,
  ability_id UUID NOT NULL REFERENCES abilities(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 3),
  learned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_creature_id, slot_index),
  UNIQUE(player_creature_id, ability_id)
);
CREATE INDEX IF NOT EXISTS idx_creature_abilities_pc ON creature_abilities(player_creature_id);

-- ── 4. Per-battle ability state (JSONB, additive) ─────────────────────────
ALTER TABLE encounters   ADD COLUMN IF NOT EXISTS ability_state JSONB;
ALTER TABLE duel_lineups ADD COLUMN IF NOT EXISTS ability_state JSONB;

-- ── 5. Widen status-effect CHECKs to include the 4 new effects ────────────
-- Dynamic drop (by column) so we don't depend on auto-generated constraint names.
DO $$
DECLARE
  target RECORD;
  cn TEXT;
  new_list TEXT := '''paralisi'',''confusione'',''sonno'',''veleno'',''scottatura'',''congelamento'',''rigenerazione'',''marchio''';
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('creatures','status_effect'),
      ('duel_lineups','active_status'),
      ('encounters','wild_status'),
      ('encounters','player_status')
    ) AS t(tbl, col)
  LOOP
    -- drop any existing CHECK constraint referencing this column
    FOR cn IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = target.tbl
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%' || target.col || '%'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', target.tbl, cn);
    END LOOP;
    -- re-add the widened constraint (nullable-friendly)
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I IS NULL OR %I IN (%s))',
      target.tbl, target.tbl || '_' || target.col || '_check', target.col, target.col, new_list
    );
  END LOOP;
END $$;

-- ── 6. Reward hooks ───────────────────────────────────────────────────────
ALTER TABLE missions ADD COLUMN IF NOT EXISTS reward_ability_id UUID REFERENCES abilities(id);

-- qr_codes.type: widen to include 'abilita' (keep all existing values)
DO $$
DECLARE cn TEXT;
BEGIN
  FOR cn IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'qr_codes' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE qr_codes DROP CONSTRAINT %I', cn);
  END LOOP;
  ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_type_check
    CHECK (type IN ('uovo','indizio','oggetto','boss','evento','creatura','abilita'));
END $$;

-- ── 7. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE abilities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_abilities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE creature_abilities ENABLE ROW LEVEL SECURITY;

-- Catalogue: readable by all authenticated players; writable by admin only.
DROP POLICY IF EXISTS "abilities_read" ON abilities;
CREATE POLICY "abilities_read" ON abilities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "abilities_admin_write" ON abilities;
CREATE POLICY "abilities_admin_write" ON abilities FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Owned tokens: own rows only; admin sees all (mirrors player_inventory).
DROP POLICY IF EXISTS "pa_own" ON player_abilities;
CREATE POLICY "pa_own" ON player_abilities FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- Learned moveset: own rows; admin sees all.
DROP POLICY IF EXISTS "ca_own" ON creature_abilities;
CREATE POLICY "ca_own" ON creature_abilities FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- Duel participants may READ the moveset of any creature in their duel
-- (so each client can render the opponent's moves). Mirrors ce_duel_read (040).
DROP POLICY IF EXISTS "ca_duel_read" ON creature_abilities;
CREATE POLICY "ca_duel_read" ON creature_abilities FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM duel_lineups dl
      JOIN duels d ON d.id = dl.duel_id
      WHERE dl.player_creature_id = creature_abilities.player_creature_id
        AND (d.challenger_id = auth.uid() OR d.opponent_id = auth.uid())
    )
  );
