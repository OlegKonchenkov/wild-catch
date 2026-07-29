-- Ability power recalibration, after the base attack was moved onto the same
-- damage formula as abilities.
--
-- Background. Until now there were two formulas:
--   base attack : atk × variance                     (rng.ts, NO defence term)
--   ability     : atk × power × variance × 120/(120+def)   (combat.ts)
-- So an ability had to overcome a mitigation the free ATTACCA button ignored —
-- at DEF 40 that's ×0.75, meaning an ability needed power ≥ ~1.33 just to draw
-- level with pressing attack. 13 of the 29 attack abilities sat below that line.
--
-- Both paths now use calculateCombatDamage, so the break-even is exactly
-- power = 1.00 and it no longer drifts with the defender's DEF. Re-checking the
-- catalogue against that line, the seeded values are almost all fine:
--   * multi-hit moves multiply out above 1 (Raffica 0.55×2-3, Sferzata 0.4×3-5,
--     Tempesta di Foglie 0.5×2-4, Ondata Adriatica 0.7×2-3);
--   * sub-1 single hits buy a status or lifesteal (Colpo Paralizzante 0.9 +
--     paralisi 0.45; Assorbimento 1.0 + 50% lifesteal; Morsa Gelida 1.0 +
--     congelamento).
-- Exactly ONE ability is still strictly worse than doing nothing special:
--
-- Colpo Rapido — power 0.7, single hit, no status, no cooldown, no charge.
-- Nothing to trade for the missing 30%. Its original justification was
-- `priority: 1`, which no resolver has ever read (removed in 074). And it is the
-- FIRST special move the game gives you, as the tutorial's M4 reward — so the
-- move that teaches "abilities are worth using" was teaching the opposite.
--
-- New shape: 1.15 power at 95% accuracy. Expected value ≈ 1.09, a modest ~9%
-- edge over the free attack in exchange for a real 5% miss chance. It stays the
-- weakest attack ability in the catalogue (next up is Zanna Velenosa at 1.1 with
-- a status attached), which is right for a level-1 comune move, but it is now
-- an upgrade rather than a trap.

UPDATE abilities
SET power = 1.15,
    accuracy = 0.95,
    description = 'Un attacco rapido e sempre pronto: nessuna ricarica, nessun tempo di carica. Veloce, quindi a volte manca il bersaglio.'
WHERE name = 'Colpo Rapido';
