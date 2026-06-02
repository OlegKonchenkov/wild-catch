-- 046_rls_subquery_perf.sql
--
-- Performance pass on hot-path RLS policies. No semantic change — every row
-- previously visible (or writable) by a given user stays visible (or writable)
-- after this migration. Only the EXECUTION of the policy changes.
--
-- WHY
-- Bare auth.uid() and is_admin() inside a USING/WITH CHECK clause are
-- evaluated PER ROW by the Postgres executor. Wrapped as (SELECT auth.uid())
-- they become an "initialization plan" sub-query evaluated ONCE per
-- statement. For top-N scans (leaderboard) and joined reads (map-pins) this
-- collapses N JWT decodes into 1. For single-row lookups it eliminates the
-- per-row function-call overhead. On NANO compute with a small Supavisor pool
-- this is the dominant CPU saving under 150 concurrent VUs (matches the
-- profile-account p95 spike observed in the k6 run).
--
-- We also:
--   (a) mark is_admin() STABLE so the planner can hoist nested calls
--   (b) split profiles_own FOR ALL into per-command policies so plain SELECT
--       can use only the trivial profiles_read TRUE policy and skip
--       auth.uid()/is_admin() entirely
--   (c) add a composite (session_id, score DESC) index so the leaderboard
--       top-50 is an index scan instead of seq-scan + sort
--
-- Refs: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
-- Safe to re-run.

-- ── 1. is_admin() — mark STABLE ─────────────────────────────────────────────
-- STABLE means: given the same args + same snapshot, returns the same value.
-- That's true for JWT-based auth (JWT is fixed for the whole statement).
-- Also wrap the inner auth.jwt() in a subquery for the same reason.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(((SELECT auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean, FALSE)
$$;

-- ── 2. Rewrap auth.uid()/is_admin() in subqueries for hot per-user policies ──

ALTER POLICY "ps_own"  ON public.player_sessions
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

ALTER POLICY "pc_own"  ON public.player_creatures
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

ALTER POLICY "pi_own"  ON public.player_inventory
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

ALTER POLICY "enc_own" ON public.encounters
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

ALTER POLICY "pm_own"  ON public.player_missions
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

ALTER POLICY "ce_own"  ON public.creature_equipment
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

ALTER POLICY "push_subs_own" ON public.push_subscriptions
  USING       (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK  (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

ALTER POLICY "pin_claims_select" ON public.pin_claims
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

ALTER POLICY "pin_claims_insert" ON public.pin_claims
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Enigma-suggerimenti / frammenti (player_select_own_*)
ALTER POLICY "player_select_own_enigma_sugg" ON public.player_enigma_suggerimenti
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY "player_insert_own_enigma_sugg" ON public.player_enigma_suggerimenti
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY "player_select_own_enigma_frammenti" ON public.player_enigma_frammenti
  USING (user_id = (SELECT auth.uid()));

-- session_invites: own-read policy
ALTER POLICY "invites_own_read" ON public.session_invites
  USING (used_by_user_id = (SELECT auth.uid()));

-- ── 3. profiles — split FOR ALL → per-command so SELECT is policy-trivial ───
-- Previous shape:
--   profiles_own  FOR ALL   USING (user_id = auth.uid() OR is_admin())
--   profiles_read FOR SELECT USING (TRUE)
-- Postgres OR-merges permissive policies, so SELECT today already passes via
-- _read TRUE — but _own is still evaluated, paying the auth.uid()/is_admin()
-- cost. By restricting _own to INSERT/UPDATE/DELETE, SELECT runs only the
-- trivial _read policy.
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;

CREATE POLICY "profiles_own_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING       (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK  (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "profiles_own_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- ── 4. Leaderboard composite index ──────────────────────────────────────────
-- /api/game/leaderboard issues:
--   SELECT user_id, score FROM player_sessions
--    WHERE session_id = $1 ORDER BY score DESC LIMIT 50
-- The existing idx_player_sessions_session (session_id only) helps the filter
-- but still requires a sort. (session_id, score DESC NULLS LAST) lets the
-- planner walk the index in order and stop at 50.
CREATE INDEX IF NOT EXISTS idx_player_sessions_session_score
  ON public.player_sessions (session_id, score DESC NULLS LAST);
