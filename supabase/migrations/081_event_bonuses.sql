-- Make the `evento` reward type actually do something.
--
-- `evento` has been authorable on map pins and QR codes since the loot
-- dispenser shipped (see PinPayloadEvento in components/admin/PinPayloadForms.tsx,
-- whose placeholder literally suggests "spawn_boost, gold_rain…"), but the
-- server side was a passthrough:
--
--   case 'evento':
--     return { type, ok: true, detail: { eventType: payload.event_type, effect: payload.effect } }
--
-- No multiplier was ever applied, anywhere. The organiser configured a "double
-- EXP hour", the player claimed the pin, read a congratulatory message, and
-- received nothing. An entire advertised feature category was cosmetic.
--
-- Storage is a single JSONB column rather than a column per effect so new event
-- kinds don't need a migration each:
--
--   { "exp_boost":   { "mult": 2,   "until": "2026-07-29T18:00:00Z" },
--     "gold_rain":   { "mult": 1.5, "until": "2026-07-29T17:30:00Z" },
--     "spawn_boost": { "mult": 2,   "until": "2026-07-29T17:45:00Z" } }
--
-- Expired entries are ignored on read (lib/game/event-bonuses.ts) rather than
-- cleaned up on a schedule — they're overwritten the next time the same bonus
-- is granted, so no cron and no dead rows.

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS event_bonuses JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN player_sessions.event_bonuses IS
  'Timed multipliers from `evento` rewards: { kind: { mult, until } }. Read via lib/game/event-bonuses.ts; expired entries are ignored, not purged.';
