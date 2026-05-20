-- Migration 042 — Track which session-end push reminders have already fired.
--
-- Stores the minute thresholds (e.g. {30,10,1}) the cron job has already
-- pushed for the current session lifecycle, so re-runs don't double-notify.
-- Reset to '{}' by admin/session/restart and admin/session/update (when
-- end_at changes) so a rescheduled session can fire reminders again.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS push_reminders_sent INTEGER[] NOT NULL DEFAULT '{}';
