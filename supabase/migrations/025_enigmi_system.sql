-- Migration 025 — Enigmi system
--
-- Introduces a centralized Enigmi entity and two sub-entity tables:
--   enigma_frammenti (associable to creatures)
--   enigma_suggerimenti (associable to QR codes and map pins)
--
-- Adds FK columns to creatures, session_map_pins, and qr_codes.
-- Existing inline enigma fields on creatures are preserved for backward compat.

-- Central enigmi table
CREATE TABLE IF NOT EXISTS enigmi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  solution TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('facile', 'medio', 'difficile')) DEFAULT 'medio',
  reward_type TEXT CHECK (reward_type IN ('exp', 'gold', 'oggetto', 'creatura')),
  reward_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Frammenti: sub-entities of enigmi, associable to creatures
CREATE TABLE IF NOT EXISTS enigma_frammenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enigma_id UUID NOT NULL REFERENCES enigmi(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  video_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suggerimenti: sub-entities of enigmi, associable to QR codes or pins
CREATE TABLE IF NOT EXISTS enigma_suggerimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enigma_id UUID NOT NULL REFERENCES enigmi(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  image_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK on creatures to reference a specific frammento
ALTER TABLE creatures
  ADD COLUMN IF NOT EXISTS enigma_frammento_id UUID REFERENCES enigma_frammenti(id) ON DELETE SET NULL;

-- Add FK on session_map_pins so enigma-type pins reference an enigma entity
ALTER TABLE session_map_pins
  ADD COLUMN IF NOT EXISTS enigma_id UUID REFERENCES enigmi(id) ON DELETE SET NULL;

-- Add FK on qr_codes so indizio-type QRs reference a specific suggerimento
ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS enigma_suggerimento_id UUID REFERENCES enigma_suggerimenti(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE enigmi ENABLE ROW LEVEL SECURITY;
ALTER TABLE enigma_frammenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE enigma_suggerimenti ENABLE ROW LEVEL SECURITY;

-- Admin full access (is_admin() function already exists)
CREATE POLICY "admin_all_enigmi" ON enigmi FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "admin_all_frammenti" ON enigma_frammenti FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "admin_all_suggerimenti" ON enigma_suggerimenti FOR ALL TO authenticated USING (is_admin());

-- Players can read enigmi for sessions they're in (solution never exposed via RLS; it's filtered in API)
CREATE POLICY "player_read_enigmi" ON enigmi FOR SELECT TO authenticated
  USING (session_id IN (SELECT session_id FROM player_sessions WHERE user_id = auth.uid()));
CREATE POLICY "player_read_frammenti" ON enigma_frammenti FOR SELECT TO authenticated
  USING (enigma_id IN (SELECT id FROM enigmi WHERE session_id IN (
    SELECT session_id FROM player_sessions WHERE user_id = auth.uid())));
CREATE POLICY "player_read_suggerimenti" ON enigma_suggerimenti FOR SELECT TO authenticated
  USING (enigma_id IN (SELECT id FROM enigmi WHERE session_id IN (
    SELECT session_id FROM player_sessions WHERE user_id = auth.uid())));

-- Indexes on FK columns used in RLS subqueries
CREATE INDEX IF NOT EXISTS idx_enigmi_session_id ON enigmi(session_id);
CREATE INDEX IF NOT EXISTS idx_enigma_frammenti_enigma_id ON enigma_frammenti(enigma_id);
CREATE INDEX IF NOT EXISTS idx_enigma_suggerimenti_enigma_id ON enigma_suggerimenti(enigma_id);
