-- Migration 032 — Tutorial enigma + solve infrastructure
--
-- Adds the missing pieces of the enigmi system: a record of which enigmi
-- a player has solved, and a record of which frammenti they've collected
-- directly (i.e. not via creature captures — used by the tutorial to grant
-- frammenti as mission rewards). Then seeds a tutorial enigma "anima"
-- with 2 frammenti, 1 free suggerimento, and a 7th tutorial mission
-- (type='enigma') that closes the apprenticeship.

-- ── 1. player_enigmi: tracks solve state ───────────────────────────────────
CREATE TABLE IF NOT EXISTS player_enigmi (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES sessions(id)   ON DELETE CASCADE,
  enigma_id   UUID NOT NULL REFERENCES enigmi(id)     ON DELETE CASCADE,
  solved_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, session_id, enigma_id)
);

ALTER TABLE player_enigmi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_player_enigmi" ON player_enigmi
  FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "player_select_own_enigmi" ON player_enigmi
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Inserts are server-side via service role (admin client). No player INSERT
-- policy on purpose: the solve endpoint authorises and grants rewards.

CREATE INDEX IF NOT EXISTS idx_player_enigmi_user_session
  ON player_enigmi(user_id, session_id);

-- ── 2. player_enigma_frammenti: direct grants of frammenti ─────────────────
-- The base flow ties a frammento to a creature, so capturing the creature
-- "unlocks" it. The tutorial can't lean on that (capture pool is random,
-- the tutorial creature might not even have a frammento set). This table
-- gives the server a way to grant a specific frammento outside that path.
CREATE TABLE IF NOT EXISTS player_enigma_frammenti (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  session_id    UUID NOT NULL REFERENCES sessions(id)          ON DELETE CASCADE,
  frammento_id  UUID NOT NULL REFERENCES enigma_frammenti(id)  ON DELETE CASCADE,
  obtained_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, session_id, frammento_id)
);

ALTER TABLE player_enigma_frammenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_player_enigma_frammenti" ON player_enigma_frammenti
  FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "player_select_own_enigma_frammenti" ON player_enigma_frammenti
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_player_enigma_frammenti_user_session
  ON player_enigma_frammenti(user_id, session_id);

-- ── 3. Tutorial enigma seed ────────────────────────────────────────────────
-- Solution: "anima" — 5 letters, easy to guess once both frammenti and the
-- free suggerimento are visible. We seed it on the tutorial session (not
-- global) so it only appears in the tutorial enigmi list.

INSERT INTO enigmi
  (id, session_id, title, description, solution, difficulty, reward_type, reward_payload)
VALUES (
  '7470a4e1-d41d-0500-0000-000000000501',
  '7470a101-d41d-0500-0000-000000000001',
  'L''Essenza del Daimon',
  'Il maestro ti porge un foglio ingiallito: "Ogni Daimon ne è custode. Senza, sarebbe solo un guscio vuoto. Trova la parola che ne descrive il cuore."',
  'anima',
  'facile',
  'gold',
  '{"gold": 200, "exp": 50}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 2 frammenti — descrizioni narrative che, assieme al suggerimento gratuito,
-- portano alla parola "anima".
INSERT INTO enigma_frammenti
  (id, enigma_id, title, description, order_index)
VALUES
  ('7470a4f2-d41d-0500-0000-000000000601',
   '7470a4e1-d41d-0500-0000-000000000501',
   'Frammento del Respiro',
   'Senza di essa, un corpo si muove ma non vive. È ciò che distingue un Daimon da una statua di pietra.',
   1),
  ('7470a4f2-d41d-0500-0000-000000000602',
   '7470a4e1-d41d-0500-0000-000000000501',
   'Frammento dell''Eco',
   'Cinque lettere, comincia con la prima dell''alfabeto. I poeti l''hanno cantata, i filosofi l''hanno cercata. È il dono che ogni Daimon riceve alla nascita.',
   2)
ON CONFLICT (id) DO NOTHING;

-- 1 suggerimento "gratuito" — normalmente si troverebbe su un pin o QR;
-- nel tutorial viene pre-concesso allo start per spiegare il meccanismo.
INSERT INTO enigma_suggerimenti
  (id, enigma_id, text, order_index)
VALUES (
  '7470a503-d41d-0500-0000-000000000701',
  '7470a4e1-d41d-0500-0000-000000000501',
  'Consiglio del Maestro (gratuito): rispondi con un''unica parola, tutta minuscola. È un sostantivo, non un aggettivo.',
  1
)
ON CONFLICT (id) DO NOTHING;

-- ── 4. 7th tutorial mission: solve the enigma ─────────────────────────────
-- Chained after mission 6 ("Maestro Daimologo"). Target is the enigma UUID;
-- the solve endpoint emits a 'enigma' event with the enigma id which
-- incrementMissionProgress matches against this row.
INSERT INTO missions
  (id, session_id, chapter_order, title, description, type, target, target_count,
   reward_gold, reward_exp, is_required, unlock_after_mission_id)
VALUES (
  '7470a311-d41d-0500-0000-000000000407',
  '7470a101-d41d-0500-0000-000000000001',
  7,
  'L''Enigma del Maestro',
  '"Ultimo passo, ragazzo." Il vecchio si china e srotola una pergamena. "Gli enigmi sono il pane di un Daimologo: li trovi catturando creature (i frammenti) o scansionando i sigilli (i suggerimenti). Apri la sezione 🧩 Enigmi nel menu, leggi tutto, e rispondimi. Te ne regalo uno facile."',
  'enigma',
  '7470a4e1-d41d-0500-0000-000000000501',
  1,
  200, 50, false,
  '7470a311-d41d-0500-0000-000000000406'
)
ON CONFLICT (id) DO NOTHING;
