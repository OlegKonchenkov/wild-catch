-- Migration 034 — Tutorial: ensure 3 captures before the boss fight
--
-- The boss fight (M5 in v2) lets the player use 1-3 of their owned
-- creatures vs a single level-3 boss. With only 1 capture under the
-- belt (M2 in v2), the fight is winnable but uncomfortably steep:
-- one level-1 creature with ~+0% scaling vs a level-3 boss with
-- +28% HP / +20% ATK is a 50-50 even with the catch bonus item.
--
-- Insert a NEW mission between M4 (shop, where the player buys Rete)
-- and M5 (boss QR), requiring 2 more captures. Total catches before
-- the boss → 3 (M2's 1 + new one's 2), so the player walks into the
-- fight with a 3-creature squad. The shop precedes the new mission
-- so the player has Rete + Esca → the extra catches are quick and
-- educational, not grindy.
--
-- Chain rewires:
--   M1 (401) walk        order 1   after null
--   M2 (402) catch 1     order 2   after 401  [grants frammento1]
--   M3 (403) qr item     order 3   after 402
--   M4 (404) shop rete   order 4   after 403
--   NEW (412) catch 2 more  order 5   after 404
--   M5 (405) boss QR     order 6   after 412  [grants frammento2]
--   M6 (406) walk 50m    order 7   after 405
--   M7 (407) enigma      order 8   after 406

-- ── 1. Wipe in-flight tutorial progress so the new chain is consistent ────
-- Players who were mid-tutorial would otherwise have a player_missions row
-- on M5 pointing at the old prerequisite (M4) — and the new mission would
-- never appear in their flow. Following migration 031's playbook: nuke
-- per-(user, tutorial-session) progress; the tutorial is replayable by
-- design.
DELETE FROM player_missions
WHERE session_id = '7470a101-d41d-0500-0000-000000000001'
  AND completed_at IS NULL;

-- ── 2. Insert the new "expand your squad" mission ─────────────────────────
INSERT INTO missions
  (id, session_id, chapter_order, title, description, type, target, target_count,
   reward_gold, reward_exp, is_required, unlock_after_mission_id)
VALUES (
  '7470a311-d41d-0500-0000-000000000412',
  '7470a101-d41d-0500-0000-000000000001',
  5,
  'Espandi la squadra',
  '"Una sola creatura non basta per affrontare un Capo del Tirocinio." Il maestro ti porge la nuova Rete. "Cattura altri due Daimon. Con tre compagni potrai schierare una squadra completa — gli oggetti che hai raccolto ti aiuteranno."',
  'cattura', '', 2,
  150, 40, false,
  '7470a311-d41d-0500-0000-000000000404'
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Re-point M5 (boss QR) to unlock AFTER the new mission ──────────────
UPDATE missions SET
  chapter_order = 6,
  unlock_after_mission_id = '7470a311-d41d-0500-0000-000000000412',
  description = '"Hai una squadra. Hai gli strumenti. Sei pronto." Il maestro ti guarda serio. "Evoca il Capo del Tirocinio dalla mappa e mettiti alla prova — schiera fino a tre creature, alterna gli attacchi, usa pozioni se serve. Qualunque sia l''esito, avrai imparato cosa significa duellare."'
WHERE id = '7470a311-d41d-0500-0000-000000000405';

-- ── 4. Shift M6 (final walk) and M7 (enigma) chapter_order ────────────────
UPDATE missions SET chapter_order = 7
WHERE id = '7470a311-d41d-0500-0000-000000000406';
UPDATE missions SET chapter_order = 8
WHERE id = '7470a311-d41d-0500-0000-000000000407';

-- ── 5. Soften M2 narrative copy to match the new pacing ────────────────────
-- M2 is now the first of three captures; the description shouldn't sound
-- like a final achievement. Subtle tweak only.
UPDATE missions SET
  description = '"Avverto già una presenza nelle vicinanze..." Il maestro sorride. "Cattura il tuo primo Daimon — un compagno per cominciare. Ne servono almeno tre per la squadra, ma ogni viaggio inizia con uno."'
WHERE id = '7470a311-d41d-0500-0000-000000000402';
