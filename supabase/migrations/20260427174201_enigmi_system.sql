-- Central enigmi table
CREATE TABLE IF NOT EXISTS enigmi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  solution TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('facile', 'medio', 'difficile')) DEFAULT 'medio',
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
CREATE POLICY "admin_all_enigmi" ON enigmi FOR ALL USING (is_admin());
CREATE POLICY "admin_all_frammenti" ON enigma_frammenti FOR ALL USING (is_admin());
CREATE POLICY "admin_all_suggerimenti" ON enigma_suggerimenti FOR ALL USING (is_admin());

-- Players can read enigmi for sessions they're in (solution never exposed via RLS; it's filtered in API)
CREATE POLICY "player_read_enigmi" ON enigmi FOR SELECT
  USING (session_id IN (SELECT session_id FROM player_sessions WHERE user_id = auth.uid()));
CREATE POLICY "player_read_frammenti" ON enigma_frammenti FOR SELECT
  USING (enigma_id IN (SELECT id FROM enigmi WHERE session_id IN (
    SELECT session_id FROM player_sessions WHERE user_id = auth.uid())));
CREATE POLICY "player_read_suggerimenti" ON enigma_suggerimenti FOR SELECT
  USING (enigma_id IN (SELECT id FROM enigmi WHERE session_id IN (
    SELECT session_id FROM player_sessions WHERE user_id = auth.uid())));
