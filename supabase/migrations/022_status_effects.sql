-- Status effect fields on creatures
-- status_effect: which effect this creature can apply on attack (null = none)
-- status_effect_chance: probability per attack (0.0–1.0, default 0.15 = 15%)
ALTER TABLE creatures
  ADD COLUMN IF NOT EXISTS status_effect TEXT
    CHECK (status_effect IN ('paralisi','confusione','sonno','veleno')),
  ADD COLUMN IF NOT EXISTS status_effect_chance FLOAT NOT NULL DEFAULT 0.15
    CHECK (status_effect_chance BETWEEN 0.0 AND 1.0);

-- Active status on each creature slot during a duel
-- active_status: current effect afflicting this lineup slot
-- status_turns_left: turns remaining (0 for veleno = permanent)
ALTER TABLE duel_lineups
  ADD COLUMN IF NOT EXISTS active_status TEXT
    CHECK (active_status IN ('paralisi','confusione','sonno','veleno')),
  ADD COLUMN IF NOT EXISTS status_turns_left INTEGER NOT NULL DEFAULT 0;

-- Active status on encounters (wild creature + player creature)
ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS wild_status TEXT
    CHECK (wild_status IN ('paralisi','confusione','sonno','veleno')),
  ADD COLUMN IF NOT EXISTS wild_status_turns INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player_status TEXT
    CHECK (player_status IN ('paralisi','confusione','sonno','veleno')),
  ADD COLUMN IF NOT EXISTS player_status_turns INTEGER NOT NULL DEFAULT 0;
