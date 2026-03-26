-- ============================================================
-- Migration 008 — Improved level system for 2-hour events
-- ============================================================
-- Changes:
--   • Level formula: exp/50+1  (was exp/100+1) → faster progression
--   • increment_player_stats now RETURNS level-up info so clients
--     can show level-up notifications and rewards
--   • Auto-awards 15–40 random gold on every level-up

-- Drop old void-returning function before recreating with TABLE return type
DROP FUNCTION IF EXISTS increment_player_stats(UUID, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION increment_player_stats(
  p_user_id   UUID,
  p_session_id UUID,
  p_exp       INTEGER,
  p_score     INTEGER
) RETURNS TABLE(
  old_level   INTEGER,
  new_level   INTEGER,
  leveled_up  BOOLEAN,
  gold_reward INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_exp   INTEGER;
  v_old_level INTEGER;
  v_new_exp   INTEGER;
  v_new_level INTEGER;
  v_gold      INTEGER := 0;
BEGIN
  SELECT exp, level
  INTO   v_old_exp, v_old_level
  FROM   player_sessions
  WHERE  user_id = p_user_id AND session_id = p_session_id;

  v_new_exp   := COALESCE(v_old_exp, 0) + p_exp;
  -- One level per 50 EXP (was 100) — tuned for 2-hour outdoor event
  v_new_level := GREATEST(1, v_new_exp / 50 + 1);

  IF v_new_level > COALESCE(v_old_level, 1) THEN
    v_gold := 15 + floor(random() * 26)::INTEGER;   -- 15–40 coins
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
