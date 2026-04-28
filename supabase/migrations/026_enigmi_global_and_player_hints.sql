-- Migration 026 — Enigmi globali e suggerimenti persistenti
--
-- 1. Rende enigmi.session_id nullable → enigmi possono essere "globali" (tutte le sessioni)
-- 2. Aggiorna le RLS policy su enigmi/frammenti/suggerimenti per includere session_id IS NULL
-- 3. Aggiunge enigma_suggerimento_id su session_map_pins (parallel a qr_codes)
-- 4. Crea player_enigma_suggerimenti per tracciare i suggerimenti raccolti dal giocatore

-- ── 1. Rendi session_id nullable su enigmi ─────────────────────────────────────
ALTER TABLE enigmi ALTER COLUMN session_id DROP NOT NULL;

-- ── 2. Aggiorna RLS policy player su enigmi/frammenti/suggerimenti ──────────────
-- Le policy esistenti filtrano solo per sessione; ora includono anche session_id IS NULL

DROP POLICY IF EXISTS "player_read_enigmi" ON enigmi;
CREATE POLICY "player_read_enigmi" ON enigmi FOR SELECT TO authenticated
  USING (
    session_id IS NULL OR
    session_id IN (SELECT session_id FROM player_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "player_read_frammenti" ON enigma_frammenti;
CREATE POLICY "player_read_frammenti" ON enigma_frammenti FOR SELECT TO authenticated
  USING (
    enigma_id IN (
      SELECT id FROM enigmi
      WHERE session_id IS NULL
         OR session_id IN (SELECT session_id FROM player_sessions WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "player_read_suggerimenti" ON enigma_suggerimenti;
CREATE POLICY "player_read_suggerimenti" ON enigma_suggerimenti FOR SELECT TO authenticated
  USING (
    enigma_id IN (
      SELECT id FROM enigmi
      WHERE session_id IS NULL
         OR session_id IN (SELECT session_id FROM player_sessions WHERE user_id = auth.uid())
    )
  );

-- ── 3. Aggiungi enigma_suggerimento_id a session_map_pins ──────────────────────
-- Permette a un pin di tipo 'indizio' di puntare a un suggerimento enigma nel sistema FK
ALTER TABLE session_map_pins
  ADD COLUMN IF NOT EXISTS enigma_suggerimento_id UUID REFERENCES enigma_suggerimenti(id) ON DELETE SET NULL;

-- ── 4. Tabella player_enigma_suggerimenti ──────────────────────────────────────
-- Traccia quali suggerimenti ogni giocatore ha raccolto (via QR o pin)
CREATE TABLE IF NOT EXISTS player_enigma_suggerimenti (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES sessions(id)   ON DELETE CASCADE,
  suggerimento_id UUID NOT NULL REFERENCES enigma_suggerimenti(id) ON DELETE CASCADE,
  obtained_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, session_id, suggerimento_id)
);

ALTER TABLE player_enigma_suggerimenti ENABLE ROW LEVEL SECURITY;

-- Admin: accesso completo
CREATE POLICY "admin_all_player_enigma_sugg" ON player_enigma_suggerimenti
  FOR ALL TO authenticated USING (is_admin());

-- Giocatore: legge solo i propri
CREATE POLICY "player_select_own_enigma_sugg" ON player_enigma_suggerimenti
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Giocatore: può inserire solo per sé stesso
CREATE POLICY "player_insert_own_enigma_sugg" ON player_enigma_suggerimenti
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Indici
CREATE INDEX IF NOT EXISTS idx_player_enigma_sugg_user_session
  ON player_enigma_suggerimenti(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_player_enigma_sugg_suggerimento
  ON player_enigma_suggerimenti(suggerimento_id);
