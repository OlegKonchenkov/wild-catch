-- Migration 036 — Tutorial Rete: rebalance effect_value
--
-- The tutorial Rete del Tirocinante was seeded with effect_value=10,
-- which the catch endpoint treats as a 10× multiplier on the rarity
-- base rate. Combined with the HP-weakness multiplier (up to ×3 at low
-- HP), a leggendario could reach catch_rate = 0.05 × 10 × 3 = 1.5 →
-- clamped to 100%. Effectively the player auto-caught any creature
-- they brought below half HP while holding a tutorial Rete.
--
-- Intended balance: tutorial Rete = ×2 (Great Ball equivalent).
-- Leggendario at low HP with Rete ≈ 0.05 × 2 × 2.8 = 0.28 = 28%
-- chance — meaningful boost but still requires luck.
--
-- Esca's effect_value is irrelevant for catch (the server now rejects
-- esca as a catch multiplier — see /api/game/encounter/catch), but we
-- normalize it too for consistency: 0 (passive item, no per-use value).

UPDATE items
SET effect_value = 2,
    description  = 'Una rete di buona fattura. ×2 probabilità di cattura.'
WHERE id = '7470a17e-d41d-0500-0000-000000000111';

UPDATE items
SET effect_value = 0
WHERE id = '7470a17e-d41d-0500-0000-000000000110';
