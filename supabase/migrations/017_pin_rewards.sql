-- Migration 017 — Pin rewards & claim tracking
--
-- Adds optional reward to session_map_pins (mirrors QR code payload schema)
-- and creates pin_claims to ensure each player gets each pin reward only once.

-- ── Reward columns on session_map_pins ───────────────────────────────────────
ALTER TABLE session_map_pins
  ADD COLUMN IF NOT EXISTS reward_type    TEXT,          -- oggetto|uovo|creatura|indizio|boss|evento|null
  ADD COLUMN IF NOT EXISTS reward_payload JSONB,         -- same schemas as qr_codes.payload
  ADD COLUMN IF NOT EXISTS reward_radius_m INT DEFAULT 50; -- proximity threshold in metres

-- ── pin_claims: one row per (pin, user) — enforced by UNIQUE constraint ──────
CREATE TABLE IF NOT EXISTS pin_claims (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id      UUID        NOT NULL REFERENCES session_map_pins(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  session_id  UUID        NOT NULL REFERENCES sessions(id)         ON DELETE CASCADE,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pin_id, user_id)
);

-- RLS: players can read and insert their own claims; admin reads all.
ALTER TABLE pin_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pin_claims_select" ON pin_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "pin_claims_insert" ON pin_claims FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Index for fast "has this user already claimed this pin?" lookup
CREATE INDEX IF NOT EXISTS idx_pin_claims_pin_user ON pin_claims (pin_id, user_id);
