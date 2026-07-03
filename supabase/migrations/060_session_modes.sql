-- Migration 060 — Session modes: add the persistent 'avventura' kind.
--
-- The always-on tutorial session (kind='tutorial') already proves long-lived
-- sessions work; 'avventura' reuses that path for player-facing adventures
-- with no fixed end (or an optional monthly/annual deadline via end_at).
-- Event sessions are untouched: kind defaults to 'event', new columns default off.

-- ── 1. Widen the kind CHECK ─────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_kind_check') THEN
    ALTER TABLE sessions DROP CONSTRAINT sessions_kind_check;
  END IF;
  ALTER TABLE sessions
    ADD CONSTRAINT sessions_kind_check CHECK (kind IN ('event', 'tutorial', 'avventura'));
END $$;

COMMENT ON COLUMN sessions.kind IS
  'event = evento a tempo (escape-room) · tutorial = demo always-on · avventura = persistente, loop giornaliero';

-- ── 2. Daily-reward configuration ───────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS daily_rewards_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS daily_pack_id UUID REFERENCES packs(id);
