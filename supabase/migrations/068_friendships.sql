-- Migration 068 — Amici (Wave 3 / Social & Meta).
--
-- Amicizie GLOBALI (cross-sessione), basate su profiles.nickname.
-- Richiesta → pending; accettazione → accepted; rifiuto → riga eliminata.
-- L'unicità direzionale + il check API sui due versi impediscono duplicati.

CREATE TABLE IF NOT EXISTS friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  addressee_id UUID NOT NULL REFERENCES auth.users(id),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id, status);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
-- Le due parti vedono la riga; il requester crea; l'addressee risponde
-- (update/accetta o delete/rifiuta); il requester può annullare (delete).
CREATE POLICY "friendships_select" ON friendships FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid() OR is_admin());
CREATE POLICY "friendships_insert" ON friendships FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "friendships_update" ON friendships FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid());
CREATE POLICY "friendships_delete" ON friendships FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
