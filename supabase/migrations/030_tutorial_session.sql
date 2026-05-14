-- Always-on Tutorial session: a "demo" experience available to every user
-- without an invite code. Seeds a fixed-UUID sessions row + a chain of
-- missions + one QR + one item that together form a 5-10 minute guided
-- intro story ("Apprendista Daimologo").
--
-- Identifiers are intentionally fixed UUIDs so server code can reference
-- them as constants without a lookup.

-- ── 1. sessions.kind ────────────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'event';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_kind_check'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_kind_check CHECK (kind IN ('event', 'tutorial'));
  END IF;
END $$;

COMMENT ON COLUMN sessions.kind IS
  'event = normal event/sagra, tutorial = global always-on demo session anyone can join.';

CREATE INDEX IF NOT EXISTS sessions_kind_idx ON sessions (kind);

-- ── 2. The tutorial session row ─────────────────────────────────────────────
-- UUID is fixed and known by both the server (constants module) and the
-- migration. area_bounds = {} so the empty-bounds branch of route guards
-- treats it as "no geographic restriction" — the demo plays anywhere.
INSERT INTO sessions (id, name, status, kind, area_bounds, duration_minutes, auto_end)
VALUES (
  '7470a101-d41d-0500-0000-000000000001',
  'Tutorial Daimon',
  'active',
  'tutorial',
  '{}'::jsonb,
  -- duration_minutes is NOT NULL with default 120; the tutorial ignores it
  -- (no end_at set, auto_end=false), but the column still requires a value.
  9999999,
  false
)
ON CONFLICT (id) DO UPDATE SET
  status = 'active',
  kind = 'tutorial',
  name = 'Tutorial Daimon';

-- ── 3. Tutorial item: "Rete del Tirocinante" ────────────────────────────────
-- Awarded by the simulated QR scan during the tutorial. Tutorial-scoped
-- (session_id = tutorial) so it doesn't leak into the real shop catalogue.
INSERT INTO items (id, name, type, effect_value, description, shop_price, session_id, image_url)
VALUES (
  '7470a17e-d41d-0500-0000-000000000101',
  'Rete del Tirocinante',
  'rete',
  10,
  'Una semplice rete da apprendista. +10% probabilità di cattura.',
  0,
  '7470a101-d41d-0500-0000-000000000001',
  null
)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Tutorial QR ──────────────────────────────────────────────────────────
-- Type 'oggetto' so the scan handler delivers the item to the player.
-- manual_code is the 6-char fallback typeable code (also accepted by the
-- simulated-scan button — see /api/game/qr/scan ilike match).
INSERT INTO qr_codes (id, session_id, type, payload, uses_remaining, label, manual_code, unique_per_user)
VALUES (
  '7470a1c0-d41d-0500-0000-000000000201',
  '7470a101-d41d-0500-0000-000000000001',
  'oggetto',
  '{"item_id":"7470a17e-d41d-0500-0000-000000000101","quantity":1}'::jsonb,
  null,
  'Segno del Tirocinante',
  'TUTOR1',
  false
)
ON CONFLICT (id) DO NOTHING;

-- ── 5. Tutorial mission chain ───────────────────────────────────────────────
-- Four chained missions tell a mini-story about being an "apprendista
-- Daimologo". Each unlocks the next via unlock_after_mission_id so the
-- player walks them sequentially. target / target_count are calibrated so
-- the whole loop completes in 5-10 minutes of light walking.

INSERT INTO missions
  (id, session_id, chapter_order, title, description, type, target, target_count, reward_gold, reward_exp, is_required, unlock_after_mission_id)
VALUES
  ('7470a311-d41d-0500-0000-000000000301',
   '7470a101-d41d-0500-0000-000000000001',
   1,
   'I primi passi',
   'Il vecchio Daimologo ti accoglie nel suo studio impolverato. "Prima cosa, ragazzo: cammina. I Daimon dormono nei luoghi visitati. Si svelano solo a chi muove i piedi." Percorri 30 metri per cominciare il tirocinio.',
   'walk',
   '',
   30,
   50,
   10,
   false,
   null),
  ('7470a311-d41d-0500-0000-000000000302',
   '7470a101-d41d-0500-0000-000000000001',
   2,
   'Il tuo primo Daimon',
   '"Avverto già una presenza nelle vicinanze..." Il maestro sorride. "Continua a camminare e cattura il tuo primo Daimon — un compagno per la tua avventura."',
   'cattura',
   '',
   1,
   100,
   25,
   false,
   '7470a311-d41d-0500-0000-000000000301'),
  ('7470a311-d41d-0500-0000-000000000303',
   '7470a101-d41d-0500-0000-000000000001',
   3,
   'Un segno nel territorio',
   '"Qualcuno ha lasciato un sigillo qui." Il maestro indica un punto. "Nei luoghi degli eventi reali ci sono codici come questo, ai bar, alle bancarelle, ovunque. Avvicinati e tocca il segno per scoprire cosa nasconde."',
   'qr',
   'TUTOR1',
   1,
   75,
   20,
   false,
   '7470a311-d41d-0500-0000-000000000302'),
  ('7470a311-d41d-0500-0000-000000000304',
   '7470a101-d41d-0500-0000-000000000001',
   4,
   'Apprendista Daimologo',
   '"Bene. Hai visto come funziona. Cattura un altro Daimon e il tuo tirocinio sarà completo." Il maestro ti porge una mano. "Poi sarai pronto per gli eventi veri."',
   'cattura',
   '',
   1,
   200,
   50,
   false,
   '7470a311-d41d-0500-0000-000000000303')
ON CONFLICT (id) DO NOTHING;
