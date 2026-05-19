-- Migration 040 — Creature equipment (MMO-style gear)
--
-- 1. Extend items.type CHECK to include the 4 equipment slot types.
-- 2. Add stat-bonus + rarity columns to items (additive, default 0/NULL so
--    existing non-equip items are unaffected).
-- 3. New creature_equipment table binding an equipped item to a specific
--    owned creature instance (player_creatures), one item per slot.

-- ── 1. Item type constraint ────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_type_check'
  ) THEN
    ALTER TABLE items DROP CONSTRAINT items_type_check;
  END IF;
  ALTER TABLE items
    ADD CONSTRAINT items_type_check
    CHECK (type IN (
      'rete','esca','uovo','battaglia','pozione','cura','custom',
      'arma','corazza','elmo','accessorio'
    ));
END $$;

-- ── 2. Equipment stat bonus + rarity columns ───────────────────────────────
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS bonus_hp  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_atk INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_def INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rarity TEXT
    CHECK (rarity IN ('comune','non_comune','raro','epico','leggendario','mitologico'));

-- ── 3. creature_equipment table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creature_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_creature_id UUID NOT NULL REFERENCES player_creatures(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('arma','corazza','elmo','accessorio')),
  item_id UUID NOT NULL REFERENCES items(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_creature_id, slot)
);
CREATE INDEX IF NOT EXISTS idx_creature_equipment_pc ON creature_equipment(player_creature_id);

-- RLS: own rows only; admin sees all (mirrors player_inventory)
ALTER TABLE creature_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_own" ON creature_equipment FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Duel participants may READ the equipment of any creature in their duel
-- (needed so each client can render the opponent's equipped max HP/stats).
-- Mirrors the pc_duel_read pattern from migration 014.
CREATE POLICY "ce_duel_read" ON creature_equipment FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM duel_lineups dl
      JOIN duels d ON d.id = dl.duel_id
      WHERE dl.player_creature_id = creature_equipment.player_creature_id
        AND (d.challenger_id = auth.uid() OR d.opponent_id = auth.uid())
    )
  );
