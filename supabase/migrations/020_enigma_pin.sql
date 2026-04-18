-- Migration 020 — Enigma pin type
--
-- Allows session_map_pins to use reward_type = 'enigma'.
-- The payload schema is:
--   {
--     "question":      TEXT,            -- puzzle text shown to the player
--     "image_url":     TEXT | null,     -- optional image
--     "solution":      TEXT,            -- correct answer (case-insensitive match)
--     "reward_type":   "exp" | "gold" | "oggetto" | "creatura",
--     "reward_payload": { … }           -- type-specific data (same as other pin types)
--   }
--
-- No new tables needed — enigma claims use pin_claims like other pins.
-- The claim API enforces solution matching before inserting the claim row.

-- Nothing structural to add — reward_type is an unconstrained TEXT column.
-- This migration is a no-op DDL-wise; it documents the new type.

DO $$ BEGIN
  RAISE NOTICE 'Migration 020: enigma pin type registered (no DDL changes required)';
END $$;
