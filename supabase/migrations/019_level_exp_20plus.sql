-- Migration 019 — Extend level_exp_config from level 20 onwards
--
-- The config previously only defined levels 1–19, leaving no exp_to_next
-- for level 20+. After reaching level 20, players could advance further
-- with no cost (fallback formula or uncapped cumulative sum).
--
-- Fix: add levels 20–99 each requiring 860 EXP to advance (same cost as
-- the 19→20 step). Adjust the cap later as needed.

INSERT INTO level_exp_config (level, exp_to_next)
SELECT
  generate_series(20, 99) AS level,
  860                      AS exp_to_next
ON CONFLICT (level) DO NOTHING;
