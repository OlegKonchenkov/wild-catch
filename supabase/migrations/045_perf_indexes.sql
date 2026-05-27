-- 045_perf_indexes.sql
-- Indexes for hot per-player / per-session lookups that currently fall back to
-- sequential scans (these tables previously had only their primary-key index).
-- Sized for the ~100-players-per-session event load: GameShell notification &
-- event feeds, map-pin loading, and egg lookups. Columns mirror the .eq()
-- filters + ORDER BY created_at used in the app.
-- Safe to re-run (IF NOT EXISTS). Tables are small, so a plain CREATE INDEX is
-- instant; no CONCURRENTLY needed (and it keeps this runnable inside a tx).

CREATE INDEX IF NOT EXISTS idx_player_game_events_user_session_created
  ON public.player_game_events (user_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_notifications_user_session_created
  ON public.player_notifications (user_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_map_pins_session_created
  ON public.session_map_pins (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_player_eggs_user_session
  ON public.player_eggs (user_id, session_id);
