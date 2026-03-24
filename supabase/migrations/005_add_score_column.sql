-- Add running score column to player_sessions (score_final is for end-of-session snapshot)
ALTER TABLE player_sessions ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;

-- Update increment_player_stats to also track running score
CREATE OR REPLACE FUNCTION increment_player_stats(
  p_user_id UUID, p_session_id UUID, p_exp INTEGER, p_score INTEGER
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exp INTEGER;
  v_level INTEGER;
  v_new_level INTEGER;
BEGIN
  UPDATE player_sessions
  SET exp = exp + p_exp,
      score = score + p_score
  WHERE user_id = p_user_id AND session_id = p_session_id
  RETURNING exp, level INTO v_exp, v_level;

  -- Level up: every 100 EXP
  v_new_level := GREATEST(1, v_exp / 100 + 1);
  IF v_new_level > v_level THEN
    UPDATE player_sessions
    SET level = v_new_level
    WHERE user_id = p_user_id AND session_id = p_session_id;
  END IF;
END;
$$;
