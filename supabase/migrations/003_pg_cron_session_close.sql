-- Enable pg_cron extension (Supabase free tier includes this)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: close expired sessions and generate final scores
CREATE OR REPLACE FUNCTION close_expired_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Mark expired sessions as ended
  UPDATE sessions
  SET status = 'ended'
  WHERE status = 'active'
    AND auto_end = TRUE
    AND end_at IS NOT NULL
    AND NOW() >= end_at;
END;
$$;

-- Run every minute (pg_cron is free on Supabase)
SELECT cron.schedule(
  'close-expired-sessions',
  '* * * * *',
  'SELECT close_expired_sessions()'
);

-- Keep-alive: prevent Supabase free tier pausing after 7 days inactivity
-- This Vercel cron (daily) does a simple SELECT; set up via vercel.json
-- See: vercel.json -> crons -> /api/cron/keepalive
