-- Bring the ability catalogue inside the level range players actually reach.
--
-- THE PROBLEM
-- 19 of the 50 seeded abilities (38%) require min_level >= 20. Reaching level 20
-- costs 7,055 cumulative EXP (leveling.ts). A 2-hour event does not come close:
--
--   average EXP per catch, after rarity scaling (migration-era B1 change):
--     0.62×15×1 + 0.24×15×2 + 0.10×15×3 + 0.03×15×4 + 0.008×15×5 + 0.002×15×6
--     ≈ 23.6 EXP  (it was a flat 15 before rarity scaling)
--
--   50 catches + ~300 from missions/duels/boss →  1,479 EXP → level 10
--   70 catches                                 →  1,951 EXP → level 11
--   90 catches (a very active player)          →  2,422 EXP → level 13
--
-- So more than a third of the special-move content — including every single
-- charge/recharge "big hit", which is the most interesting part of the system —
-- was unreachable content that an organiser paid for and no player ever saw.
--
-- THE FIX
-- Compress the tail. Levels 1-10 are untouched: that range is where the
-- tutorial and the early event live, and its pacing is already right. Everything
-- above is folded monotonically onto 11-14, so the ORDER in which abilities
-- unlock is preserved (a move that used to gate later still gates later) while
-- the ceiling lands at level 14 ≈ 2,880 EXP — a long event or an active player,
-- and comfortable in a persistent `avventura` session, which keeps some
-- headroom instead of making everything available at once.
--
--   old 1-10  → unchanged
--   old 11-13 → 11
--   old 14-17 → 12
--   old 18-24 → 13
--   old 25+   → 14
--
-- Worth revisiting if the EXP curve or the rarity multipliers move again: the
-- ceiling should track "what a real player reaches", not a theoretical cap.

UPDATE abilities
SET min_level = CASE
  WHEN min_level <= 10 THEN min_level
  WHEN min_level <= 13 THEN 11
  WHEN min_level <= 17 THEN 12
  WHEN min_level <= 24 THEN 13
  ELSE 14
END
WHERE min_level > 10;

-- Sanity check for whoever runs this by hand:
--   SELECT min_level, count(*) FROM abilities GROUP BY 1 ORDER BY 1;
-- should show nothing above 14.
