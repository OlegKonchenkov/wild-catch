-- Migration 056 — Cultural collection: luoghi, opere, personaggi, aneddoti, trofei.
--
-- Catalogues (permanent). Player progress is per-session in player_collection.
-- Collecting a personaggio unlocks its bound special ability. Completing a
-- collection category (a "GOLD collection") awards a trophy.

CREATE TABLE IF NOT EXISTS cultural_places (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL DEFAULT '',
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,  -- null = global
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artworks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL DEFAULT '',
  place_id    UUID REFERENCES cultural_places(id) ON DELETE SET NULL,
  rarity      TEXT CHECK (rarity IS NULL OR rarity IN
                ('comune','non_comune','raro','epico','leggendario','mitologico')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS characters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  image_url          TEXT NOT NULL DEFAULT '',
  place_id           UUID REFERENCES cultural_places(id) ON DELETE SET NULL,
  rarity             TEXT CHECK (rarity IS NULL OR rarity IN
                       ('comune','non_comune','raro','epico','leggendario','mitologico')),
  unlocks_ability_id UUID REFERENCES abilities(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anecdotes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  image_url    TEXT NOT NULL DEFAULT '',
  place_id     UUID REFERENCES cultural_places(id) ON DELETE SET NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  rarity       TEXT CHECK (rarity IS NULL OR rarity IN
                 ('comune','non_comune','raro','epico','leggendario','mitologico')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_collection (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('opera','personaggio','aneddoto')),
  ref_id      UUID NOT NULL,
  copies      INT  NOT NULL DEFAULT 1 CHECK (copies >= 1),
  obtained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id, kind, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_player_collection_user_session ON player_collection(user_id, session_id);

CREATE TABLE IF NOT EXISTS trophies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL DEFAULT '',
  criteria    JSONB NOT NULL DEFAULT '{}',  -- e.g. { "kind":"personaggio", "complete_all":true } or { "place_id":"..." }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_trophies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  trophy_id  UUID NOT NULL REFERENCES trophies(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id, trophy_id)
);
CREATE INDEX IF NOT EXISTS idx_player_trophies_user_session ON player_trophies(user_id, session_id);

-- Late FK: chests.place_id → cultural_places (column added in migration 054).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chests_place_id_fkey') THEN
    ALTER TABLE chests
      ADD CONSTRAINT chests_place_id_fkey
      FOREIGN KEY (place_id) REFERENCES cultural_places(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE cultural_places   ENABLE ROW LEVEL SECURITY;
ALTER TABLE artworks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE anecdotes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trophies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_trophies   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cultural_places_read"  ON cultural_places FOR SELECT TO authenticated USING (true);
CREATE POLICY "cultural_places_admin" ON cultural_places FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "artworks_read"   ON artworks   FOR SELECT TO authenticated USING (true);
CREATE POLICY "artworks_admin"  ON artworks   FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "characters_read"  ON characters FOR SELECT TO authenticated USING (true);
CREATE POLICY "characters_admin" ON characters FOR ALL   TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "anecdotes_read"  ON anecdotes  FOR SELECT TO authenticated USING (true);
CREATE POLICY "anecdotes_admin" ON anecdotes  FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "trophies_read"   ON trophies   FOR SELECT TO authenticated USING (true);
CREATE POLICY "trophies_admin"  ON trophies   FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "player_collection_own" ON player_collection FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin()) WITH CHECK (user_id = auth.uid() OR is_admin());
CREATE POLICY "player_trophies_own"   ON player_trophies   FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin()) WITH CHECK (user_id = auth.uid() OR is_admin());
