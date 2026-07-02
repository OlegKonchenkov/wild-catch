-- Migration 059 — Weave the new systems (abilità, bustine, gemme) into the
-- tutorial, additively. The 6→7 mission arc is untouched; we only:
--   1. create a tutorial-safe "Bustina del Tirocinante" (isolated pool),
--   2. attach reward_extra to two EXISTING tutorial missions.
-- Idempotent: guarded by a name check.

DO $$
DECLARE
  v_pack     UUID := gen_random_uuid();
  v_esca     UUID := '7470a17e-d41d-0500-0000-000000000110';  -- Esca del Tirocinante (migration 031)
  v_ability  UUID := (SELECT id FROM abilities WHERE name = 'Colpo Rapido' LIMIT 1);
  -- Tutorial mission ids (migration 031)
  m_shop     UUID := '7470a311-d41d-0500-0000-000000000404';  -- M4 "L'arte del commercio"
  m_final    UUID := '7470a311-d41d-0500-0000-000000000406';  -- M6 "Maestro Daimologo" (final walk)
BEGIN
  IF EXISTS (SELECT 1 FROM packs WHERE name = 'Bustina del Tirocinante') THEN
    RAISE NOTICE 'Tutorial loot already present — skipping.';
    RETURN;
  END IF;

  -- Tutorial-safe pack: only currency + the tutorial esca. No global creatures
  -- or loot leak into the isolated tutorial catalogue.
  INSERT INTO packs (id, name, description, rarity, min_drops, max_drops, price_gold, price_gemme)
  VALUES (v_pack, 'Bustina del Tirocinante',
    'Una bustina omaggio del maestro: monete, gemme e un''esca.', 'comune', 3, 3, NULL, NULL);

  INSERT INTO pack_pool (pack_id, reward_type, reward_payload, weight, rarity_tier, min_qty, max_qty) VALUES
    (v_pack, 'gold',  '{}'::jsonb, 40, 'comune',     20, 60),
    (v_pack, 'gemme', '{}'::jsonb, 35, 'non_comune',  5, 15),
    (v_pack, 'exp',   '{}'::jsonb, 15, 'comune',     15, 40),
    (v_pack, 'oggetto', jsonb_build_object('item_id', v_esca, 'quantity', 1), 10, 'comune', 1, 1);

  -- M4 completion → an ungated ability token (learn in DaimonDex, use vs the boss).
  IF v_ability IS NOT NULL THEN
    UPDATE missions SET reward_extra =
      jsonb_build_array(jsonb_build_object('type', 'abilita',
        'payload', jsonb_build_object('abilityId', v_ability, 'quantity', 1)))
    WHERE id = m_shop;
  END IF;

  -- M6 (final walk) → gemme + the tutorial bustina.
  UPDATE missions SET reward_extra = jsonb_build_array(
    jsonb_build_object('type', 'gemme',   'payload', jsonb_build_object('amount', 30)),
    jsonb_build_object('type', 'bustina', 'payload', jsonb_build_object('pack_id', v_pack))
  ) WHERE id = m_final;

  RAISE NOTICE 'Tutorial loot/abilities woven in.';
END $$;
