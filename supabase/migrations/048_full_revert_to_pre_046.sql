-- 048_full_revert_to_pre_046.sql
--
-- "Nuclear" revert: undo every RLS/index change made by migrations 046+047
-- and restore the database to the exact shape it had on commit 271db05 (the
-- last k6 baseline that produced healthy numbers — profile-account p95
-- ≈ 3 s, 0% failure).
--
-- Migration 047 already restored is_admin() and the per-table ALTER POLICY
-- changes, so the only deltas still living in the database from 046 are:
--   (a) idx_player_sessions_session_score  — added by 046, kept by 047
--   (b) profiles_own_{insert,update,delete} — the per-cmd split that
--       replaced the original "profiles_own FOR ALL"
--
-- This file removes (a) and undoes (b), recreating the original FOR ALL
-- policy. After this runs the database is bit-identical (RLS + index-wise)
-- to the pre-046 state.
--
-- Idempotent.

-- 1. Drop the composite index added by 046
DROP INDEX IF EXISTS public.idx_player_sessions_session_score;

-- 2. Drop the per-cmd split introduced by 046 and recreate the original
--    FOR ALL policy from migration 006.
DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_delete" ON public.profiles;

-- Recreate exactly as in 006_profiles.sql
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());
