-- Migration 063 — Quiz culturali (agganciati alla Collezione).
--
--   quizzes        — catalogo (globale o per sessione); correct_index NON deve
--                    mai raggiungere il client (la game API lo strippa, come
--                    per le soluzioni degli enigmi)
--   player_quizzes — stato del giocatore: tentativi + risolto (per sessione).
-- Sblocco: se unlock_anecdote_id è impostato, il quiz appare bloccato finché
-- il giocatore non ha quell'aneddoto nella player_collection.
-- Regola: tentativi illimitati, ricompensa SOLO alla prima risposta corretta.

CREATE TABLE IF NOT EXISTS quizzes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID REFERENCES sessions(id) ON DELETE CASCADE,
  place_id           UUID REFERENCES cultural_places(id) ON DELETE SET NULL,
  unlock_anecdote_id UUID REFERENCES anecdotes(id) ON DELETE SET NULL,
  question           TEXT NOT NULL,
  options            JSONB NOT NULL DEFAULT '[]',   -- array di stringhe (2–6)
  correct_index      INT NOT NULL DEFAULT 0 CHECK (correct_index >= 0),
  reward             JSONB,                          -- [{type,payload}] · null = default 5 gemme
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quizzes_place ON quizzes(place_id);

CREATE TABLE IF NOT EXISTS player_quizzes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  quiz_id    UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  attempts   INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  solved_at  TIMESTAMPTZ,
  UNIQUE (user_id, session_id, quiz_id)
);
CREATE INDEX IF NOT EXISTS idx_player_quizzes_user_session ON player_quizzes(user_id, session_id);

ALTER TABLE quizzes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_quizzes ENABLE ROW LEVEL SECURITY;

-- Catalogo: NESSUNA select per i giocatori (correct_index non deve trapelare
-- via PostgREST). La game API legge con l'admin client e strippa il campo.
CREATE POLICY "quizzes_admin" ON quizzes FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "player_quizzes_own" ON player_quizzes FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());
