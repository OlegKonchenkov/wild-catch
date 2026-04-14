-- Migration 015 — Add p_gold parameter to increment_player_stats
--
-- Fixes a race condition in awardDuelResults: the old code did a separate
-- SELECT gold + UPDATE gold, which is not atomic. Now the caller passes
-- p_gold directly and the RPC applies it in the same UPDATE as exp/score/level,
-- making the entire reward atomic and eliminating the extra round-trip.

DROP FUNCTION IF EXISTS increment_player_stats(UUID, UUID, INTEGER, INTEGER);

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
  v_old_exp   INTEGER;
  v_old_level INTEGER;
  v_new_exp   INTEGER;
  v_new_level INTEGER;
  v_level_gold INTEGER := 0;
BEGIN
  SELECT exp, level
  INTO   v_old_exp, v_old_level
  FROM   player_sessions
  WHERE  user_id = p_user_id AND session_id = p_session_id;

  v_new_exp   := COALESCE(v_old_exp, 0) + p_exp;
  v_new_level := GREATEST(1, v_new_exp / 50 + 1);

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
    v_level_gold;  -- gold_reward is the level-up bonus only; p_gold is the caller's award
END;
$$;
