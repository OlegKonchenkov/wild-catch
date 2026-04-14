-- ============================================================
-- Migration 014 — Fix duel RLS, Realtime, status constraint
-- ============================================================

-- ── Fix 1: duels RLS ─────────────────────────────────────────────────────────
-- The old FOR ALL policy blocked SELECT when a joiner was not yet
-- challenger/opponent, and blocked UPDATE when a joiner tried to claim the slot.

DROP POLICY IF EXISTS "duel_participants" ON duels;

-- Anyone can see waiting duels (to find by room code) + their own duels + admin.
CREATE POLICY "duel_select" ON duels FOR SELECT TO authenticated
  USING (
    status = 'waiting'
    OR challenger_id = auth.uid()
    OR opponent_id   = auth.uid()
    OR is_admin()
  );

-- Only the challenger creates a duel.
CREATE POLICY "duel_insert" ON duels FOR INSERT TO authenticated
  WITH CHECK (challenger_id = auth.uid() OR is_admin());

-- Waiting duels can be updated by anyone (to join); active duels by participants.
CREATE POLICY "duel_update" ON duels FOR UPDATE TO authenticated
  USING (
    status = 'waiting'
    OR challenger_id = auth.uid()
    OR opponent_id   = auth.uid()
    OR is_admin()
  );

-- Hard deletes: admin only (soft-delete via status='cancelled').
CREATE POLICY "duel_delete" ON duels FOR DELETE TO authenticated
  USING (is_admin());

-- ── Fix 2: duels status — add 'cancelled' ────────────────────────────────────
-- The cancel button was silently failing because 'cancelled' was not in the CHECK.

ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_status_check;
ALTER TABLE duels ADD CONSTRAINT duels_status_check
  CHECK (status IN ('waiting', 'active', 'ended', 'cancelled'));

-- ── Fix 3: Enable Realtime on duels ──────────────────────────────────────────
-- Without this, postgres_changes for current_turn updates never reached clients,
-- so the turn indicator never changed.

ALTER PUBLICATION supabase_realtime ADD TABLE duels;

-- ── Fix 4: duel_lineups RLS ──────────────────────────────────────────────────
-- The table already has RLS enabled but the UPDATE policies only allowed own rows,
-- blocking the server-side action route from updating the opponent's HP.

ALTER TABLE duel_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duel_lineups_select" ON duel_lineups FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM duels d
      WHERE d.id = duel_id
        AND (d.challenger_id = auth.uid() OR d.opponent_id = auth.uid())
    )
  );

CREATE POLICY "duel_lineups_insert" ON duel_lineups FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- Participants can update any lineup in their duel — attacker must update defender HP.
CREATE POLICY "duel_lineups_update" ON duel_lineups FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM duels d
      WHERE d.id = duel_id
        AND (d.challenger_id = auth.uid() OR d.opponent_id = auth.uid())
    )
  );

CREATE POLICY "duel_lineups_delete" ON duel_lineups FOR DELETE TO authenticated
  USING (is_admin());

-- ── Fix 5: player_creatures — allow reading opponent's creatures in a duel ───
-- Without this, the JOIN in duel_lineups returned null for the opponent's creature,
-- making their card invisible and causing attacks to fail silently (500 error).
-- Also needed for the duel history lineup preview.

CREATE POLICY "pc_duel_read" ON player_creatures FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM duel_lineups dl
      JOIN duels d ON d.id = dl.duel_id
      WHERE dl.player_creature_id = player_creatures.id
        AND (d.challenger_id = auth.uid() OR d.opponent_id = auth.uid())
    )
  );

-- ── Fix 6: player_sessions — allow reading opponent's level in a duel ────────
-- Without this, the opponent's level defaulted to 1, giving wrong combat stats
-- for damage calculation and HP scaling.

CREATE POLICY "ps_duel_read" ON player_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM duels d
      WHERE d.session_id = player_sessions.session_id
        AND (d.challenger_id = auth.uid() OR d.opponent_id = auth.uid())
        AND (d.challenger_id = player_sessions.user_id OR d.opponent_id = player_sessions.user_id)
    )
  );
