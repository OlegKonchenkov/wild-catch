-- Retroactive migration: creatures.session_id
--
-- The column already exists in the live database (it shows up in the generated
-- types and the admin creature form writes to it) but was never captured in a
-- migration — it was added through Supabase Studio. A fresh `supabase db reset`
-- therefore produced a schema WITHOUT it, which the spawn-pool scoping in
-- src/lib/game/config-cache.ts now depends on. IF NOT EXISTS makes this a no-op
-- against the live database and a fix against a rebuilt one.
--
-- Semantics: NULL = global creature, available in every session. A non-null
-- session_id makes the creature exclusive to that event — which is the whole
-- point of authoring per-event Daimon for a territory.

ALTER TABLE creatures
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;

-- The spawn pool filters `spawnable = true AND (session_id = $1 OR session_id IS NULL)`
-- on every encounter roll, and the starter picker does the same for comune.
-- Partial index keeps that hot path off a sequential scan as the catalogue grows.
CREATE INDEX IF NOT EXISTS idx_creatures_spawnable_session
  ON creatures (session_id)
  WHERE spawnable = true;

COMMENT ON COLUMN creatures.session_id IS
  'NULL = global catalogue (spawns everywhere). Non-null = exclusive to that session/event.';
