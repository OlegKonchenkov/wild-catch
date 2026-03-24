-- Enable RLS on all tables
ALTER TABLE creatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_of_fame ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_creatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT COALESCE(is_admin, FALSE) FROM auth.users WHERE id = auth.uid()
$$;

-- Helper: check if user is in an active session
CREATE OR REPLACE FUNCTION is_in_session(p_session_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM player_sessions
    WHERE user_id = auth.uid() AND session_id = p_session_id
  )
$$;

-- creatures: readable by all authenticated users; writable by admin only
CREATE POLICY "creatures_read" ON creatures FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "creatures_admin_write" ON creatures FOR ALL TO authenticated USING (is_admin());

-- items: same as creatures
CREATE POLICY "items_read" ON items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "items_admin_write" ON items FOR ALL TO authenticated USING (is_admin());

-- sessions: readable by authenticated; writable by admin
CREATE POLICY "sessions_read" ON sessions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sessions_admin_write" ON sessions FOR ALL TO authenticated USING (is_admin());

-- session_invites: admin can do all; players can SELECT own code only
CREATE POLICY "invites_admin" ON session_invites FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "invites_own_read" ON session_invites FOR SELECT TO authenticated
  USING (used_by_user_id = auth.uid());

-- player_sessions: own row only; admin sees all
CREATE POLICY "ps_own" ON player_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- hall_of_fame: readable by all; writable by admin only (or service role)
CREATE POLICY "hof_read" ON hall_of_fame FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "hof_admin_write" ON hall_of_fame FOR ALL TO authenticated USING (is_admin());

-- player_creatures: own rows; admin sees all
CREATE POLICY "pc_own" ON player_creatures FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- player_inventory: own rows; admin sees all
CREATE POLICY "pi_own" ON player_inventory FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- encounters: own rows; admin sees all
CREATE POLICY "enc_own" ON encounters FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- duels: participants or admin
CREATE POLICY "duel_participants" ON duels FOR ALL TO authenticated
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid() OR is_admin());

-- missions: readable by players in session; writable by admin
CREATE POLICY "missions_read" ON missions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "missions_admin_write" ON missions FOR ALL TO authenticated USING (is_admin());

-- player_missions: own rows
CREATE POLICY "pm_own" ON player_missions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- qr_codes: readable by authenticated in session; writable by admin
CREATE POLICY "qr_read" ON qr_codes FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "qr_admin_write" ON qr_codes FOR ALL TO authenticated USING (is_admin());

-- notifications: readable by all authenticated; writable by admin
CREATE POLICY "notif_read" ON notifications FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "notif_admin_write" ON notifications FOR ALL TO authenticated USING (is_admin());
