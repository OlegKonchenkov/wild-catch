-- Migration 057 — Let every reward channel carry the new loot/collection types.
--
-- 1. Widen qr_codes.type and enigmi.reward_type CHECKs to include the loot,
--    currency, and collection reward types dispensed by dispenseReward().
-- 2. Add missions.reward_extra (JSONB array of { type, payload }) so any mission
--    can drop bustine/forzieri/gemme/etc. on completion without new columns.

-- ── qr_codes.type ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qr_codes_type_check') THEN
    ALTER TABLE qr_codes DROP CONSTRAINT qr_codes_type_check;
  END IF;
  ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_type_check CHECK (type IN (
    'uovo','indizio','oggetto','boss','evento','creatura','abilita',
    'gold','exp','gemme','bustina','forziere','premio',
    'personaggio','opera','aneddoto','missione'
  ));
END $$;

-- ── enigmi.reward_type ───────────────────────────────────────────────────────
DO $$
DECLARE cn TEXT;
BEGIN
  FOR cn IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'enigmi' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%reward_type%'
  LOOP
    EXECUTE format('ALTER TABLE enigmi DROP CONSTRAINT %I', cn);
  END LOOP;
  ALTER TABLE enigmi ADD CONSTRAINT enigmi_reward_type_check
    CHECK (reward_type IS NULL OR reward_type IN (
      'exp','gold','gemme','oggetto','creatura','abilita',
      'bustina','forziere','premio','personaggio','opera','aneddoto'
    ));
END $$;

-- ── missions.reward_extra ────────────────────────────────────────────────────
ALTER TABLE missions ADD COLUMN IF NOT EXISTS reward_extra JSONB;
