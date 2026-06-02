-- 047_rls_revert_subquery_overhead.sql
--
-- Surgical revert of the parts of 046 that turned out to ADD per-call overhead
-- instead of reducing it. Empirical evidence: k6 150-VU rerun after 046 showed
-- profile-account p95 going from 2.98s → 10.52s (worse) and leaderboard
-- 1.38s → 6.17s (much worse).
--
-- Root cause: is_admin() is a LANGUAGE SQL function that Postgres was inlining
-- directly into RLS expressions. Adding STABLE + SECURITY DEFINER together,
-- *plus* wrapping calls as (SELECT public.is_admin()), defeated inlining. Each
-- policy check then paid a real function-call cost (role switch + subquery)
-- per row. For single-row lookups (the dominant traffic here) the
-- "subquery hoist" trick is pure overhead — that pattern only helps when
-- evaluating against MANY rows (top-N, joins, scans).
--
-- We KEEP the parts of 046 that were unambiguous wins:
--   • idx_player_sessions_session_score  — leaderboard index, no downside
--   • profiles_own split (FOR ALL → per-cmd)  — SELECT now skips the policy
--     entirely via the trivial profiles_read TRUE policy
--
-- We REVERT:
--   • is_admin() back to its pre-046 shape (no STABLE, no inner subquery)
--     so the planner can inline it again
--   • All ALTER POLICY changes from 046 — back to bare auth.uid() / is_admin()
--
-- Idempotent. Safe to re-run.

-- 1. is_admin() — original definition (un-STABLE, no inner SELECT)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, FALSE)
$$;

-- 2. Revert all hot-path policies back to bare expressions (re-inlining)
ALTER POLICY "ps_own"  ON public.player_sessions
  USING (user_id = auth.uid() OR is_admin());

ALTER POLICY "pc_own"  ON public.player_creatures
  USING (user_id = auth.uid() OR is_admin());

ALTER POLICY "pi_own"  ON public.player_inventory
  USING (user_id = auth.uid() OR is_admin());

ALTER POLICY "enc_own" ON public.encounters
  USING (user_id = auth.uid() OR is_admin());

ALTER POLICY "pm_own"  ON public.player_missions
  USING (user_id = auth.uid() OR is_admin());

ALTER POLICY "ce_own"  ON public.creature_equipment
  USING (user_id = auth.uid() OR is_admin());

ALTER POLICY "push_subs_own" ON public.push_subscriptions
  USING       (user_id = auth.uid() OR is_admin())
  WITH CHECK  (user_id = auth.uid() OR is_admin());

ALTER POLICY "pin_claims_select" ON public.pin_claims
  USING (user_id = auth.uid() OR is_admin());

ALTER POLICY "pin_claims_insert" ON public.pin_claims
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "player_select_own_enigma_sugg" ON public.player_enigma_suggerimenti
  USING (user_id = auth.uid());
ALTER POLICY "player_insert_own_enigma_sugg" ON public.player_enigma_suggerimenti
  WITH CHECK (user_id = auth.uid());
ALTER POLICY "player_select_own_enigma_frammenti" ON public.player_enigma_frammenti
  USING (user_id = auth.uid());

ALTER POLICY "invites_own_read" ON public.session_invites
  USING (used_by_user_id = auth.uid());

-- 3. profiles_own split — KEEP (this was a logic-level win, not micro-perf).
--    SELECT goes through only profiles_read TRUE; INSERT/UPDATE/DELETE go
--    through the split per-cmd policies. We rewrite those WITHOUT subquery
--    wrapping for the same inlining reason.
DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_delete" ON public.profiles;

CREATE POLICY "profiles_own_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING       (user_id = auth.uid() OR is_admin())
  WITH CHECK  (user_id = auth.uid() OR is_admin());

CREATE POLICY "profiles_own_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- 4. KEEP the leaderboard composite index from 046 (no rollback needed).
--    Already created by 046 with IF NOT EXISTS, so it stays.
