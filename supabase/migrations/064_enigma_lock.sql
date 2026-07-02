-- Migration 064 — Enigmi a lucchetto (slot-machine input).
--
-- lock_config JSONB: { "alphabet": "ABC…09", "length": 4 } — quando presente il
-- client mostra rulli tipo lucchetto invece del campo testo. La verifica della
-- soluzione resta invariata lato server (solve endpoint esistente).

ALTER TABLE enigmi
  ADD COLUMN IF NOT EXISTS lock_config JSONB;
