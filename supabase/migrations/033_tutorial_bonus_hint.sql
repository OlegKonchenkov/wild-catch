-- Migration 033 — Tutorial bonus enigma hint
--
-- Seeds a 2nd enigma_suggerimento for the tutorial enigma "L'Essenza del
-- Daimon" (see migration 032). The free one delivered at tutorial start
-- explains the answer's shape ("una parola sola, minuscola, sostantivo").
-- This bonus one narrows further ("finisce in -a") and is delivered when
-- the player physically walks to a tutorial pin generated near their GPS.
--
-- The pin itself is generated client-side at runtime (no per-user pin
-- table), so no schema change is needed here — just the catalogue row
-- that the claim endpoint upserts into player_enigma_suggerimenti.

INSERT INTO enigma_suggerimenti
  (id, enigma_id, text, order_index)
VALUES (
  '7470a503-d41d-0500-0000-000000000702',
  '7470a4e1-d41d-0500-0000-000000000501',
  'Indizio Bonus (dal pin sulla mappa): la risposta finisce con la lettera A.',
  2
)
ON CONFLICT (id) DO NOTHING;
