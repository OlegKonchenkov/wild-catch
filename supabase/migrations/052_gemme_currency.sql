-- Migration 052 — Gemme (premium currency), per-session like gold.
--
-- Adds a `gemme` balance to player_sessions and threads a p_gemme param
-- through increment_player_stats so rewards can grant gemme atomically
-- alongside exp/score/gold (mirrors the p_gold addition in migration 015,
-- built on the level-99 curve definition from migration 023).

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS gemme INT NOT NULL DEFAULT 0;

-- Re-create with an extra trailing p_gemme arg (defaulted so existing 5-arg
-- callers keep working). Drop both the 4-arg and 5-arg prior signatures.
DROP FUNCTION IF EXISTS increment_player_stats(UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS increment_player_stats(UUID, UUID, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION increment_player_stats(
  p_user_id    UUID,
  p_session_id UUID,
  p_exp        INTEGER,
  p_score      INTEGER,
  p_gold       INTEGER DEFAULT 0,
  p_gemme      INTEGER DEFAULT 0
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
           gemme = gemme + p_gemme,
           score = score + p_score
    WHERE  user_id = p_user_id AND session_id = p_session_id;
  ELSE
    UPDATE player_sessions
    SET    exp   = v_new_exp,
           gold  = gold + p_gold,
           gemme = gemme + p_gemme,
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
