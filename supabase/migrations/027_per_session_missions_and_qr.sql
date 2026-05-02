-- Migration 027: Per-session mission progress and QR scan scoping
--
-- Problem: global missions (session_id IS NULL in missions table) and global QR codes
-- (session_id IS NULL in qr_codes) are permanently locked after the first session a
-- player encounters them, because:
--   - player_missions has UNIQUE(user_id, mission_id) with no session_id
--   - qr_scan_log has UNIQUE(qr_id, user_id) with no session_id
--
-- Fix: scope both tables per session so the same global content can be
-- engaged again in a fresh session.

-- ── 1. player_missions: add session_id ───────────────────────────────────────
ALTER TABLE player_missions
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;

-- Drop the old global unique constraint
ALTER TABLE player_missions
  DROP CONSTRAINT IF EXISTS player_missions_user_id_mission_id_key;

-- New constraint: unique per (user, mission, session).
-- NULLS NOT DISTINCT treats two NULLs as equal, so legacy rows that have
-- session_id = NULL remain deduplicated as before — no data loss.
ALTER TABLE player_missions
  ADD CONSTRAINT player_missions_user_mission_session_uniq
  UNIQUE NULLS NOT DISTINCT (user_id, mission_id, session_id);

-- Index for fast per-session progress lookups
CREATE INDEX IF NOT EXISTS idx_player_missions_user_session
  ON player_missions (user_id, session_id);

-- ── 2. qr_scan_log: ensure table exists with correct schema ──────────────────
-- The table was created via Supabase Studio (not in a prior migration).
-- Create it properly here so its constraints are version-controlled.
CREATE TABLE IF NOT EXISTS qr_scan_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id      UUID        NOT NULL REFERENCES qr_codes(id)     ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  session_id UUID        REFERENCES sessions(id)              ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE qr_scan_log ENABLE ROW LEVEL SECURITY;

-- Drop old global unique constraint if it exists (created via Studio)
ALTER TABLE qr_scan_log
  DROP CONSTRAINT IF EXISTS qr_scan_log_qr_id_user_id_key;

-- New: unique per (qr_id, user_id, session_id) — global QRs can be scanned
-- once per session instead of once per lifetime.
-- NULLS NOT DISTINCT so rows with NULL session_id (edge-case) are still deduplicated.
CREATE UNIQUE INDEX IF NOT EXISTS qr_scan_log_qr_user_session_uniq
  ON qr_scan_log (qr_id, user_id, session_id) NULLS NOT DISTINCT;

-- RLS: players read/insert their own rows; admins read all
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'qr_scan_log' AND policyname = 'qr_scan_log_own'
  ) THEN
    CREATE POLICY "qr_scan_log_own" ON qr_scan_log
      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
