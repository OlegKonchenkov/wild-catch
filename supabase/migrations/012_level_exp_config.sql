-- 012: Dynamic EXP curve config + update increment_player_stats

CREATE TABLE IF NOT EXISTS level_exp_config (
  level       INTEGER PRIMARY KEY CHECK (level >= 1),
  exp_to_next INTEGER NOT NULL DEFAULT 50 CHECK (exp_to_next > 0)
);

ALTER TABLE level_exp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read exp config" ON level_exp_config FOR SELECT USING (true);

INSERT INTO level_exp_config (level, exp_to_next) VALUES
  (1, 30),  (2, 50),  (3, 70),  (4, 95),  (5, 125),
  (6, 160), (7, 200), (8, 240), (9, 285), (10, 330),
  (11, 380),(12, 430),(13, 485),(14, 540),(15, 600),
  (16, 660),(17, 725),(18, 790),(19, 860)
ON CONFLICT (level) DO NOTHING;

CREATE OR REPLACE FUNCTION public.increment_player_stats(
  p_user_id    uuid,
  p_session_id uuid,
  p_exp        integer,
  p_score      integer
)
RETURNS TABLE(old_level integer, new_level integer, leveled_up boolean, gold_reward integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_exp       INTEGER;
  v_old_level     INTEGER;
  v_new_exp       INTEGER;
  v_new_level     INTEGER;
  v_gold          INTEGER := 0;
  v_config_count  INTEGER;
BEGIN
  SELECT exp, level
  INTO   v_old_exp, v_old_level
  FROM   player_sessions
  WHERE  user_id = p_user_id AND session_id = p_session_id;

  v_new_exp := COALESCE(v_old_exp, 0) + p_exp;

  SELECT COUNT(*) INTO v_config_count FROM level_exp_config;

  IF v_config_count = 0 THEN
    v_new_level := GREATEST(1, v_new_exp / 50 + 1);
  ELSE
    SELECT COALESCE(MAX(t.target_level), 1)
    INTO   v_new_level
    FROM (
      SELECT level + 1 AS target_level,
             SUM(exp_to_next) OVER (ORDER BY level
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS min_exp
      FROM   level_exp_config
    ) t
    WHERE t.min_exp <= v_new_exp;
  END IF;

  IF v_new_level > COALESCE(v_old_level, 1) THEN
    v_gold := 15 + floor(random() * 26)::INTEGER;
    UPDATE player_sessions
    SET    exp   = v_new_exp,
           level = v_new_level,
           gold  = gold + v_gold,
           score = score + p_score
    WHERE  user_id = p_user_id AND session_id = p_session_id;
  ELSE
    UPDATE player_sessions
    SET    exp   = v_new_exp,
           score = score + p_score
    WHERE  user_id = p_user_id AND session_id = p_session_id;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(v_old_level, 1),
    v_new_level,
    v_new_level > COALESCE(v_old_level, 1),
    v_gold;
END;
$$;
