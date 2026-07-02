-- Migration 058 — Seed "3 of each" loot & collection content.
--
-- Idempotent: guarded by a name check so re-running does nothing. Uses explicit
-- UUIDs in a DO block so chests/packs can cross-reference keys, prizes, etc.
-- Themed to the existing Adriatic-coast / Roman setting.

DO $$
DECLARE
  -- keys (items)
  k_bronze UUID := gen_random_uuid();
  k_silver UUID := gen_random_uuid();
  k_gold   UUID := gen_random_uuid();
  -- chests
  c_foro    UUID := gen_random_uuid();
  c_tempio  UUID := gen_random_uuid();
  c_imper   UUID := gen_random_uuid();
  -- packs
  p_bronze UUID := gen_random_uuid();
  p_silver UUID := gen_random_uuid();
  p_gold   UUID := gen_random_uuid();
  -- prizes
  pr_cena UUID := gen_random_uuid();
  pr_buono UUID := gen_random_uuid();
  pr_tour UUID := gen_random_uuid();
  -- places
  pl_foro  UUID := gen_random_uuid();
  pl_teatro UUID := gen_random_uuid();
  pl_museo UUID := gen_random_uuid();
  -- artworks
  a_mosaico UUID := gen_random_uuid();
  a_statua  UUID := gen_random_uuid();
  a_anfora  UUID := gen_random_uuid();
  -- characters
  ch_ovidio UUID := gen_random_uuid();
  ch_traiano UUID := gen_random_uuid();
  ch_sibilla UUID := gen_random_uuid();
  -- anecdotes
  an_1 UUID := gen_random_uuid();
  an_2 UUID := gen_random_uuid();
  an_3 UUID := gen_random_uuid();
  -- trophies
  t_opere UUID := gen_random_uuid();
  t_person UUID := gen_random_uuid();
  t_foro UUID := gen_random_uuid();
  -- refs to existing data (nullable)
  v_item UUID := (SELECT id FROM items WHERE type IN ('esca','rete','battaglia') ORDER BY created_at LIMIT 1);
  v_creature UUID := (SELECT id FROM creatures ORDER BY spawn_weight DESC LIMIT 1);
  ab1 UUID := (SELECT id FROM abilities ORDER BY created_at LIMIT 1);
  ab2 UUID := (SELECT id FROM abilities ORDER BY created_at LIMIT 1 OFFSET 1);
  ab3 UUID := (SELECT id FROM abilities ORDER BY created_at LIMIT 1 OFFSET 2);
BEGIN
  IF EXISTS (SELECT 1 FROM packs WHERE name = 'Bustina di Bronzo') THEN
    RAISE NOTICE 'Loot seed already present — skipping.';
    RETURN;
  END IF;

  -- ── Keys (items) ──────────────────────────────────────────────────────────
  INSERT INTO items (id, name, type, effect_value, description, shop_price, rarity) VALUES
    (k_bronze, 'Chiave di Bronzo', 'chiave', 0, 'Apre i forzieri più comuni del tesoro.', 150, 'comune'),
    (k_silver, 'Chiave d''Argento', 'chiave', 0, 'Apre i forzieri dei templi.', 400, 'raro'),
    (k_gold,   'Chiave d''Oro', 'chiave', 0, 'Apre i forzieri imperiali più preziosi.', 900, 'epico');

  -- ── Special prizes ────────────────────────────────────────────────────────
  INSERT INTO special_prizes (id, name, description, rarity, redemption_note) VALUES
    (pr_cena,  'Cena per due', 'Una cena per due persone in un ristorante partner.', 'leggendario', 'Mostra questo codice al ristorante partner per riscattare.'),
    (pr_buono, 'Buono negozio del museo', 'Buono sconto da spendere al bookshop del museo.', 'epico', 'Presenta il codice alla cassa del museo.'),
    (pr_tour,  'Tour guidato VIP', 'Un tour guidato esclusivo dei luoghi storici della città.', 'leggendario', 'Prenota il tour comunicando questo codice all''infopoint.');

  -- ── Cultural places ───────────────────────────────────────────────────────
  INSERT INTO cultural_places (id, name, description, session_id) VALUES
    (pl_foro,   'Foro Romano', 'Il cuore civico dell''antica città, tra colonne e basiliche.', NULL),
    (pl_teatro, 'Teatro Antico', 'Dove risuonavano le tragedie e le commedie del mondo classico.', NULL),
    (pl_museo,  'Museo Archeologico', 'Custode dei reperti e delle storie del territorio.', NULL);

  -- ── Artworks (opere) ──────────────────────────────────────────────────────
  INSERT INTO artworks (id, name, description, place_id, rarity) VALUES
    (a_mosaico, 'Mosaico del Tritone', 'Un mosaico marino che raffigura un tritone tra le onde dell''Adriatico.', pl_foro, 'raro'),
    (a_statua,  'Statua di Augusto', 'Ritratto marmoreo dell''imperatore, simbolo del potere di Roma.', pl_museo, 'epico'),
    (a_anfora,  'Anfora vinaria', 'Un''anfora usata per il commercio del vino lungo la costa.', pl_teatro, 'non_comune');

  -- ── Characters (personaggi) — each unlocks an ability if one exists ───────
  INSERT INTO characters (id, name, description, place_id, rarity, unlocks_ability_id) VALUES
    (ch_ovidio,  'Ovidio', 'Il poeta delle Metamorfosi, voce immortale dell''amore e del mito.', pl_teatro, 'epico', ab1),
    (ch_traiano, 'Traiano', 'L''imperatore costruttore, che portò Roma alla massima espansione.', pl_foro, 'leggendario', ab2),
    (ch_sibilla, 'Sibilla', 'La profetessa che leggeva il destino nei versi oracolari.', pl_museo, 'raro', ab3);

  -- ── Anecdotes (aneddoti/storie) ───────────────────────────────────────────
  INSERT INTO anecdotes (id, title, body, place_id, character_id, rarity) VALUES
    (an_1, 'L''esilio di Ovidio', 'Si narra che il poeta, esiliato sulle rive del mar Nero, non smise mai di scrivere versi rivolti alla sua amata Roma.', pl_teatro, ch_ovidio, 'raro'),
    (an_2, 'La colonna di Traiano', 'Un fregio a spirale racconta, scena dopo scena, le campagne militari dell''imperatore.', pl_foro, ch_traiano, 'non_comune'),
    (an_3, 'I libri sibillini', 'Custoditi in gran segreto, venivano consultati solo nei momenti di grave pericolo per la città.', pl_museo, ch_sibilla, 'epico');

  -- ── Chests (forzieri) — deterministic contents, key-gated ─────────────────
  INSERT INTO chests (id, name, description, rarity, place_id, key_requirements, contents) VALUES
    (c_foro, 'Forziere del Foro', 'Un baule sepolto tra le rovine del Foro.', 'raro', pl_foro,
      jsonb_build_array(jsonb_build_object('item_id', k_bronze, 'qty', 1)),
      jsonb_build_array(
        jsonb_build_object('type','gold','payload', jsonb_build_object('amount', 200)),
        jsonb_build_object('type','opera','payload', jsonb_build_object('artwork_id', a_mosaico))
      ) || CASE WHEN v_item IS NOT NULL THEN jsonb_build_array(jsonb_build_object('type','oggetto','payload', jsonb_build_object('item_id', v_item, 'quantity', 1))) ELSE '[]'::jsonb END),
    (c_tempio, 'Forziere del Tempio', 'Un forziere votivo nascosto in un tempio.', 'epico', pl_teatro,
      jsonb_build_array(jsonb_build_object('item_id', k_silver, 'qty', 1), jsonb_build_object('item_id', k_bronze, 'qty', 1)),
      jsonb_build_array(
        jsonb_build_object('type','gemme','payload', jsonb_build_object('amount', 25)),
        jsonb_build_object('type','opera','payload', jsonb_build_object('artwork_id', a_anfora))
      ) || CASE WHEN ab1 IS NOT NULL THEN jsonb_build_array(jsonb_build_object('type','abilita','payload', jsonb_build_object('abilityId', ab1, 'quantity', 1))) ELSE '[]'::jsonb END),
    (c_imper, 'Forziere Imperiale', 'Il baule più prezioso, sigillato con due chiavi d''oro.', 'leggendario', pl_museo,
      jsonb_build_array(jsonb_build_object('item_id', k_gold, 'qty', 2)),
      jsonb_build_array(
        jsonb_build_object('type','premio','payload', jsonb_build_object('prize_id', pr_tour)),
        jsonb_build_object('type','opera','payload', jsonb_build_object('artwork_id', a_statua)),
        jsonb_build_object('type','gemme','payload', jsonb_build_object('amount', 60))
      ));

  -- ── Packs (bustine) ───────────────────────────────────────────────────────
  INSERT INTO packs (id, name, description, rarity, min_drops, max_drops, price_gold, price_gemme) VALUES
    (p_bronze, 'Bustina di Bronzo', 'Una bustina comune: monete, oggetti e qualche sorpresa.', 'comune', 3, 4, 300, NULL),
    (p_silver, 'Bustina d''Argento', 'Bustina rara con migliori probabilità e chiavi.', 'raro', 3, 5, 800, NULL),
    (p_gold,   'Bustina d''Oro', 'La bustina più preziosa: personaggi, forzieri e premi rari.', 'epico', 4, 5, NULL, 40);

  -- ── Pack pools ────────────────────────────────────────────────────────────
  INSERT INTO pack_pool (pack_id, reward_type, reward_payload, weight, rarity_tier, min_qty, max_qty) VALUES
    -- Bronze: mostly gold/gemme/keys
    (p_bronze, 'gold',  '{}'::jsonb, 45, 'comune', 50, 150),
    (p_bronze, 'gemme', '{}'::jsonb, 20, 'non_comune', 3, 8),
    (p_bronze, 'oggetto', jsonb_build_object('item_id', k_bronze, 'quantity', 1), 20, 'comune', 1, 1),
    (p_bronze, 'exp',   '{}'::jsonb, 15, 'comune', 20, 60),
    -- Silver: better odds, silver keys, chests, characters
    (p_silver, 'gold',  '{}'::jsonb, 30, 'non_comune', 100, 300),
    (p_silver, 'gemme', '{}'::jsonb, 25, 'raro', 8, 20),
    (p_silver, 'oggetto', jsonb_build_object('item_id', k_silver, 'quantity', 1), 18, 'raro', 1, 1),
    (p_silver, 'forziere', jsonb_build_object('chest_id', c_foro), 15, 'raro', 1, 1),
    (p_silver, 'personaggio', jsonb_build_object('character_id', ch_sibilla), 12, 'raro', 1, 1),
    -- Gold: premium — characters, chests, prizes (rare)
    (p_gold, 'gemme', '{}'::jsonb, 26, 'epico', 20, 50),
    (p_gold, 'forziere', jsonb_build_object('chest_id', c_imper), 22, 'epico', 1, 1),
    (p_gold, 'personaggio', jsonb_build_object('character_id', ch_traiano), 20, 'leggendario', 1, 1),
    (p_gold, 'oggetto', jsonb_build_object('item_id', k_gold, 'quantity', 1), 20, 'epico', 1, 1),
    (p_gold, 'premio', jsonb_build_object('prize_id', pr_buono), 8, 'leggendario', 1, 1),
    (p_gold, 'premio', jsonb_build_object('prize_id', pr_cena), 4, 'mitologico', 1, 1);

  -- Add a creature drop to bronze/silver if the catalogue has any creatures
  IF v_creature IS NOT NULL THEN
    INSERT INTO pack_pool (pack_id, reward_type, reward_payload, weight, rarity_tier, min_qty, max_qty) VALUES
      (p_silver, 'creatura', jsonb_build_object('creature_id', v_creature), 10, 'raro', 1, 1);
  END IF;

  -- ── Trophies ──────────────────────────────────────────────────────────────
  INSERT INTO trophies (id, name, description, criteria) VALUES
    (t_opere,  'Curatore', 'Colleziona tutte le opere d''arte.', jsonb_build_object('kind','opera','complete_all', true)),
    (t_person, 'Storico', 'Colleziona tutti i personaggi culturali.', jsonb_build_object('kind','personaggio','complete_all', true)),
    (t_foro,   'Padrone del Foro', 'Completa la collezione del Foro Romano.', jsonb_build_object('place_id', pl_foro::text));

  RAISE NOTICE 'Loot seed inserted.';
END $$;
