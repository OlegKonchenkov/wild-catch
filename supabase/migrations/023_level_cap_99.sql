-- Migration 023 — Align level progression with fixed 20+ EXP curve and max level 99
--
-- Rules:
--   • Levels 1–19 use the configured level_exp_config values
--   • Levels 20–99 always require 860 EXP each
--   • Players cannot level past 99

INSERT INTO level_exp_config (level, exp_to_next)
SELECT
  generate_series(20, 99) AS level,
  860                      AS exp_to_next
ON CONFLICT (level) DO UPDATE
SET exp_to_next = EXCLUDED.exp_to_next;

DROP FUNCTION IF EXISTS increment_player_stats(UUID, UUID, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION increment_player_stats(
  p_user_id    UUID,
  p_session_id UUID,
  p_exp        INTEGER,
  p_score      INTEGER,
  p_gold       INTEGER DEFAULT 0
) RETURNS TABLE(
  old_level    INTEGER,
  new_level    INTEGER,
  leveled_up   BOOLEAN,
  gold_reward  INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_exp        INTEGER;
  v_old_level      INTEGER;
  v_new_exp        INTEGER;
  v_new_level      INTEGER;
  v_level_gold     INTEGER := 0;
BEGIN
  SELECT exp, level
  INTO   v_old_exp, v_old_level
  FROM   player_sessions
  WHERE  user_id = p_user_id AND session_id = p_session_id;

  v_new_exp := GREATEST(0, COALESCE(v_old_exp, 0) + p_exp);

  SELECT LEAST(
    COALESCE(MAX(t.target_level), 1),
    99
  )
  INTO v_new_level
  FROM (
    SELECT
      level + 1 AS target_level,
      SUM(exp_to_next) OVER (
        ORDER BY level
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS min_exp
    FROM level_exp_config
    WHERE level BETWEEN 1 AND 99
  ) t
  WHERE t.min_exp <= v_new_exp;

  IF v_new_level > COALESCE(v_old_level, 1) THEN
    v_level_gold := 15 + floor(random() * 26)::INTEGER;  -- 15–40 level-up bonus
    UPDATE player_sessions
    SET    exp   = v_new_exp,
           level = v_new_level,
           gold  = gold + v_level_gold + p_gold,
           score = score + p_score
    WHERE  user_id = p_user_id AND session_id = p_session_id;
  ELSE
    UPDATE player_sessions
    SET    exp   = v_new_exp,
           gold  = gold + p_gold,
           score = score + p_score
    WHERE  user_id = p_user_id AND session_id = p_session_id;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(v_old_level, 1),
    v_new_level,
    v_new_level > COALESCE(v_old_level, 1),
    v_level_gold;
END;
$$;
