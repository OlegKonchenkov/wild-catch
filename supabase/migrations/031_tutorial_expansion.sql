-- Tutorial v2: expand the "Apprendista Daimologo" mini-story from 4 to 6
-- missions so a player exercises every meaningful gameplay loop —
-- walking, capture, QR (item + boss), shop purchase, boss fight, final
-- stroll. Tutorial v1 ran for less than a day and the only players were
-- the development team; wiping in-flight state is safe.

-- ── 1. Wipe every per-(user, tutorial-session) progress row ────────────────
DELETE FROM player_missions     WHERE session_id = '7470a101-d41d-0500-0000-000000000001';
DELETE FROM player_inventory    WHERE session_id = '7470a101-d41d-0500-0000-000000000001';
DELETE FROM qr_scan_log         WHERE session_id = '7470a101-d41d-0500-0000-000000000001';
DELETE FROM encounters          WHERE session_id = '7470a101-d41d-0500-0000-000000000001';
DELETE FROM boss_fights         WHERE session_id = '7470a101-d41d-0500-0000-000000000001';
DELETE FROM pin_claims          WHERE session_id = '7470a101-d41d-0500-0000-000000000001';
DELETE FROM player_eggs         WHERE session_id = '7470a101-d41d-0500-0000-000000000001';

-- ── 2. Drop the v1 catalogue (missions, QR, item) ─────────────────────────
DELETE FROM missions  WHERE session_id = '7470a101-d41d-0500-0000-000000000001';
DELETE FROM qr_codes  WHERE session_id = '7470a101-d41d-0500-0000-000000000001';
DELETE FROM items     WHERE session_id = '7470a101-d41d-0500-0000-000000000001';

-- ── 3. Tutorial-scoped items (v2) ───────────────────────────────────────────
-- Esca: awarded by the first simulated QR (no shop entry — shop_price=0).
-- Rete: stocked in the tutorial shop at an affordable price.
INSERT INTO items (id, name, type, effect_value, description, shop_price, session_id, image_url)
VALUES
  ('7470a17e-d41d-0500-0000-000000000110',
   'Esca del Tirocinante', 'esca', 20,
   'L''eredità del maestro: una semplice esca artigianale. Attira creature più rare per 10 minuti.',
   0,
   '7470a101-d41d-0500-0000-000000000001',
   null),
  ('7470a17e-d41d-0500-0000-000000000111',
   'Rete del Tirocinante', 'rete', 10,
   'Una rete di buona fattura. +10% probabilità di cattura.',
   100,
   '7470a101-d41d-0500-0000-000000000001',
   null);

-- ── 4. Tutorial QR codes (v2) ──────────────────────────────────────────────
-- QR #1 ("oggetto"): the "Simula scansione QR" button surfaces this on
-- mission 3. It awards the Esca.
INSERT INTO qr_codes (id, session_id, type, payload, uses_remaining, label, manual_code, unique_per_user)
VALUES (
  '7470a1c0-d41d-0500-0000-000000000210',
  '7470a101-d41d-0500-0000-000000000001',
  'oggetto',
  '{"item_id":"7470a17e-d41d-0500-0000-000000000110","quantity":1}'::jsonb,
  null,
  'Segno del Tirocinante',
  'TUTOR1',
  false
);

-- QR #2 ("boss"): triggers a tutorial boss fight on mission 5. We pick
-- an existing comune-rarity, spawnable creature dynamically so the
-- migration works against any creature catalogue. If the database has
-- no creatures yet the boss QR is omitted (mission 5 will then be
-- unreachable — acceptable for empty test databases).
DO $$
DECLARE
  boss_creature_id uuid;
BEGIN
  SELECT id INTO boss_creature_id
  FROM creatures
  WHERE spawnable = true AND rarity = 'comune'
  ORDER BY created_at ASC
  LIMIT 1;

  IF boss_creature_id IS NOT NULL THEN
    INSERT INTO qr_codes (id, session_id, type, payload, uses_remaining, label, manual_code, unique_per_user)
    VALUES (
      '7470a1c0-d41d-0500-0000-000000000220',
      '7470a101-d41d-0500-0000-000000000001',
      'boss',
      jsonb_build_object(
        'creatures', jsonb_build_array(
          jsonb_build_object('creature_id', boss_creature_id, 'level_override', 3)
        ),
        'reward', jsonb_build_object('gold', 300, 'exp', 100)
      ),
      null,
      'Capo del Tirocinio',
      'TUTBSS',
      false
    );
  END IF;
END $$;

-- ── 5. Tutorial mission chain (v2) ──────────────────────────────────────────
-- 6 chained missions, each unlocking the next. Walk → catch → QR-item →
-- shop-purchase → QR-boss → final walk. Designed to take 10-15 minutes
-- and brush every major feature.

INSERT INTO missions
  (id, session_id, chapter_order, title, description, type, target, target_count, reward_gold, reward_exp, is_required, unlock_after_mission_id)
VALUES
  ('7470a311-d41d-0500-0000-000000000401',
   '7470a101-d41d-0500-0000-000000000001',
   1,
   'I primi passi',
   'Il vecchio Daimologo ti accoglie nel suo studio impolverato. "Prima cosa, ragazzo: cammina. I Daimon dormono nei luoghi visitati. Si svelano solo a chi muove i piedi." Percorri 30 metri per cominciare il tirocinio.',
   'walk', '', 30,
   50, 10, false,
   null),

  ('7470a311-d41d-0500-0000-000000000402',
   '7470a101-d41d-0500-0000-000000000001',
   2,
   'Il tuo primo Daimon',
   '"Avverto già una presenza nelle vicinanze..." Il maestro sorride. "Continua a camminare e cattura il tuo primo Daimon — un compagno per la tua avventura."',
   'cattura', '', 1,
   100, 25, false,
   '7470a311-d41d-0500-0000-000000000401'),

  ('7470a311-d41d-0500-0000-000000000403',
   '7470a101-d41d-0500-0000-000000000001',
   3,
   'Un segno nel territorio',
   '"Qualcuno ha lasciato un sigillo qui." Il maestro indica un punto sulla mappa. "Nei luoghi degli eventi reali troverai codici come questo, ai bar, alle bancarelle, ovunque. Tocca il segno per scoprire cosa nasconde."',
   'qr', 'TUTOR1', 1,
   75, 20, false,
   '7470a311-d41d-0500-0000-000000000402'),

  ('7470a311-d41d-0500-0000-000000000404',
   '7470a101-d41d-0500-0000-000000000001',
   4,
   'L''arte del commercio',
   '"Ottimo: ora hai un''esca. Ma ti servirà anche una buona rete." Il maestro ti porge un sacchetto d''oro. "Vai al mercato — premi l''icona dello shop in basso — e procurati una Rete del Tirocinante."',
   'collect', 'Rete del Tirocinante', 1,
   50, 25, false,
   '7470a311-d41d-0500-0000-000000000403'),

  ('7470a311-d41d-0500-0000-000000000405',
   '7470a101-d41d-0500-0000-000000000001',
   5,
   'Sfida il Capo del Tirocinio',
   '"Un vero Daimologo affronta avversari più forti." Il maestro ti guarda serio. "Evoca il Capo del Tirocinio dalla mappa e mettiti alla prova. La tua squadra è pronta — qualunque sia l''esito, avrai imparato qualcosa."',
   'qr', 'TUTBSS', 1,
   75, 30, false,
   '7470a311-d41d-0500-0000-000000000404'),

  ('7470a311-d41d-0500-0000-000000000406',
   '7470a101-d41d-0500-0000-000000000001',
   6,
   'Maestro Daimologo',
   '"Hai imparato i fondamenti, ragazzo. Ora cammina ancora un po'' — gli eventi reali ti attendono in giro per il territorio." Percorri 50 metri finali per completare il tirocinio.',
   'walk', '', 50,
   500, 100, false,
   '7470a311-d41d-0500-0000-000000000405');
