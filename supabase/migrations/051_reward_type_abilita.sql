-- Migration 051 — allow 'abilita' as an enigmi reward_type
--
-- enigmi.reward_type has a CHECK (migration 025: exp|gold|oggetto|creatura).
-- Widen it to include 'abilita' so admins can set it as a first-class reward.
-- (session_map_pins.reward_type is free-text with no CHECK — nothing to change
-- there; the claim route already handles the 'abilita' case + payload.)

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
    CHECK (reward_type IS NULL OR reward_type IN
      ('exp','gold','oggetto','creatura','abilita'));
END $$;
