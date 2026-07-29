-- Data retention: purge game data 12 months after an event closes.
--
-- Until now nothing ever expired. The privacy notice said game data stayed
-- "finché non vengono rimossi dall'organizzatore o cancelli l'account", which
-- in practice meant forever — every session ever played, with its GPS-derived
-- progress and per-player history, accumulating indefinitely. GDPR art. 5(1)(e)
-- requires keeping personal data no longer than necessary, and a stated period
-- you actually enforce is worth more than a vague promise.
--
-- The window is 12 months from `sessions.end_at`: long enough to cover the next
-- edition of an annual event and any prize/leaderboard dispute, short enough
-- that the database isn't a growing liability.
--
-- WHAT IS DELETED
--   The session itself. Everything player-scoped hangs off sessions.id with
--   ON DELETE CASCADE (player_sessions, player_creatures, player_inventory,
--   encounters, duels, player_missions, …), so removing the session row removes
--   the whole event with it — the same mechanism account deletion relies on
--   after migration 082.
--
-- WHAT SURVIVES
--   * the account and profile: those live until the user deletes them
--   * hall_of_fame: kept deliberately. It is the final ranking of a public
--     event, it is the one thing players come back to look at, and it holds
--     no location or behavioural data. Its FK to sessions is nulled rather
--     than cascaded (see below).
--   * the always-on tutorial session, which has no end_at and is not an event.

-- hall_of_fame must outlive the session it refers to, so its FK cannot cascade.
DO $$
DECLARE
  conname_found TEXT;
BEGIN
  SELECT con.conname INTO conname_found
  FROM pg_constraint con
  JOIN pg_class cl     ON cl.oid = con.conrelid
  JOIN pg_class refcl  ON refcl.oid = con.confrelid
  WHERE con.contype = 'f'
    AND cl.relname = 'hall_of_fame'
    AND refcl.relname = 'sessions'
  LIMIT 1;

  IF conname_found IS NOT NULL THEN
    EXECUTE format('ALTER TABLE hall_of_fame DROP CONSTRAINT %I', conname_found);
    EXECUTE format(
      'ALTER TABLE hall_of_fame ADD CONSTRAINT %I FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL',
      conname_found
    );
    RAISE NOTICE 'hall_of_fame.session_id -> ON DELETE SET NULL (survives retention purge)';
  END IF;
END $$;

ALTER TABLE hall_of_fame ALTER COLUMN session_id DROP NOT NULL;

-- Retention window, in months. Change here and the job follows.
CREATE OR REPLACE FUNCTION retention_months() RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$ SELECT 12 $$;

CREATE OR REPLACE FUNCTION purge_expired_sessions()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  purged INTEGER;
BEGIN
  WITH doomed AS (
    DELETE FROM sessions
    WHERE status = 'ended'
      AND end_at IS NOT NULL
      AND end_at < NOW() - (retention_months() || ' months')::INTERVAL
    RETURNING id
  )
  SELECT count(*) INTO purged FROM doomed;

  IF purged > 0 THEN
    RAISE NOTICE 'retention: purged % session(s) older than % months', purged, retention_months();
  END IF;

  RETURN purged;
END;
$$;

COMMENT ON FUNCTION purge_expired_sessions() IS
  'GDPR art. 5(1)(e): deletes sessions ended more than retention_months() ago. Player data cascades; hall_of_fame survives with a null session_id.';

-- Daily at 04:15 UTC — off-peak, and far from the every-minute session-close job.
-- Unschedule first so re-running this migration doesn't create a duplicate.
DO $$
BEGIN
  PERFORM cron.unschedule('purge-expired-sessions');
EXCEPTION WHEN OTHERS THEN
  NULL; -- not scheduled yet
END $$;

SELECT cron.schedule(
  'purge-expired-sessions',
  '15 4 * * *',
  'SELECT purge_expired_sessions()'
);
