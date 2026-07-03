-- Migration 069 — Gruppi / classifiche private (Wave 3).
--
-- Gruppi globali (classe/istituto), creati dall'admin (nome → codice join).
-- I giocatori entrano col codice; la classifica di sessione si può filtrare
-- sui membri del proprio gruppo.

CREATE TABLE IF NOT EXISTS groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);

ALTER TABLE groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- I gruppi si leggono (nome visibile ai membri e a chi ha il codice via API);
-- scritture solo admin/service (creazione admin, join via API con admin client).
CREATE POLICY "groups_read" ON groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_admin" ON groups FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Ognuno vede le proprie membership (e quelle del proprio gruppo per la classifica).
CREATE POLICY "group_members_read" ON group_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR is_admin()
    OR group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid())
  );
CREATE POLICY "group_members_own_write" ON group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "group_members_own_delete" ON group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());
