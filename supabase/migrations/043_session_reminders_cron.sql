-- Session-reminder cron: enable pg_net so Postgres can call the Next.js
-- route /api/cron/session-reminders. The actual cron.schedule() entry is
-- registered out-of-band (not in this migration) because it embeds the
-- production URL and CRON_SECRET as literals — keeping them out of git.
-- See .vercel/_setup_cron.sql (gitignored, generated locally) for the
-- exact one-time command. The schedule lives in cron.job and survives
-- DB restarts.

CREATE EXTENSION IF NOT EXISTS pg_net;
