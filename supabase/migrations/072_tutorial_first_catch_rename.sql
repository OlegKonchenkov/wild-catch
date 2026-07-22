-- Migration 072 — Tutorial M2: rename "Il tuo primo Daimon" → "Cattura un Daimon"
--
-- Playtest feedback (Marco): the M2 mission "Il tuo primo Daimon" unlocks after
-- the M1 walk, but wild encounters can already fire DURING that walk — so a
-- player who catches one early is told to catch their "first" Daimon when they
-- already own one. Renaming to the neutral objective "Cattura un Daimon" removes
-- the incorrect "first" claim regardless of what happened during M1.
--
-- Pure text update: the mission id, chain order, prerequisites and rewards are
-- untouched, so no in-flight player_missions wipe is needed (unlike 034, which
-- rewired the chain). Players mid-tutorial simply see the new label.

UPDATE missions SET
  title = 'Cattura un Daimon',
  description = '"Avverto già una presenza nelle vicinanze..." Il maestro sorride. "Cattura un Daimon — un compagno per cominciare. Ne servono almeno tre per la squadra, ma ogni viaggio inizia con uno."'
WHERE id = '7470a311-d41d-0500-0000-000000000402';
