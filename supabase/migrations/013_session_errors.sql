-- Session error log: tracks notable API errors during a session
-- Useful for admin monitoring without polluting application logs

CREATE TABLE IF NOT EXISTS session_errors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  source      TEXT        NOT NULL,  -- e.g. 'shop', 'item', 'encounter', 'boss'
  error_code  TEXT        NOT NULL,  -- e.g. 'session_ended', 'insufficient_gold', 'server_error'
  message     TEXT        NOT NULL,
  context     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_errors_session
  ON session_errors(session_id, created_at DESC);

ALTER TABLE session_errors ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only read errors (admin pages)
CREATE POLICY "authenticated_can_read" ON session_errors
  FOR SELECT TO authenticated USING (true);

-- Only service-role (API routes) can insert/delete
-- (no INSERT policy for authenticated → insert only via service key)
