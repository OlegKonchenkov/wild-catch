-- Migration 050 — Seed ~50 special abilities
--
-- Spread across the 5 elements + neutral and every mechanic the engine supports
-- (multi-hit, charge, recharge, status infliction incl. the new effects, heal,
-- lifesteal, self-buff, enemy-debuff, priority). Gated by level / element /
-- rarity so progression feels earned.
--
-- Named-column INSERTs (one per ability): only non-default columns are listed;
-- everything else falls back to the schema defaults from migration 049.

-- ── Neutral (learnable by any element) ──────────────────────────────────────
INSERT INTO abilities (name, description, category, rarity, power, priority, hits_min, hits_max, min_level, animation_key, color)
  VALUES ('Colpo Rapido', 'Un attacco fulmineo che colpisce sempre per primo.', 'attacco', 'comune', 0.7, 1, 1, 1, 1, 'basic_strike', '#94A3B8');
INSERT INTO abilities (name, description, category, rarity, power, accuracy, cooldown, min_level, animation_key, color)
  VALUES ('Fendente Poderoso', 'Un fendente pesante caricato di forza bruta.', 'attacco', 'non_comune', 1.6, 0.95, 2, 8, 'basic_strike', '#94A3B8');
INSERT INTO abilities (name, description, category, rarity, power, accuracy, hits_min, hits_max, min_level, animation_key, color)
  VALUES ('Raffica di Colpi', 'Colpisce da 2 a 3 volte in rapida successione.', 'attacco', 'non_comune', 0.55, 0.95, 2, 3, 12, 'multi_strike', '#94A3B8');
INSERT INTO abilities (name, description, category, rarity, power, charge_turns, cooldown, min_level, min_rarity, animation_key, color)
  VALUES ('Caricamento Devastante', 'Si carica per un turno, poi scatena un colpo enorme.', 'attacco', 'raro', 2.6, 1, 3, 25, 'raro', 'charge_beam', '#F0843C');
INSERT INTO abilities (name, description, category, rarity, power, accuracy, recharge_turns, min_level, min_rarity, animation_key, color)
  VALUES ('Furia Cieca', 'Devastante, ma richiede un turno di recupero.', 'attacco', 'raro', 2.8, 0.9, 1, 22, 'raro', 'fire_nova', '#F0843C');
INSERT INTO abilities (name, description, category, rarity, power, status_effect, status_chance, cooldown, min_level, animation_key, color)
  VALUES ('Marchio dell''Ombra', 'Marchia il nemico: subirà più danni dagli attacchi.', 'stato', 'non_comune', 0.4, 'marchio', 1, 2, 10, 'shadow_mark', '#F472B6');
INSERT INTO abilities (name, description, category, rarity, target, buff_atk, cooldown, min_level, animation_key, color)
  VALUES ('Grido di Guerra', 'Aumenta il proprio attacco per il resto della lotta.', 'potenziamento', 'non_comune', 'self', 0.35, 3, 9, 'buff_roar', '#FBBF24');
INSERT INTO abilities (name, description, category, rarity, target, buff_def, cooldown, min_level, animation_key, color)
  VALUES ('Difesa Totale', 'Rinsalda la guardia, aumentando la difesa.', 'difesa', 'comune', 'self', 0.5, 2, 5, 'rock_guard', '#60A5FA');
INSERT INTO abilities (name, description, category, rarity, accuracy, debuff_atk, cooldown, min_level, animation_key, color)
  VALUES ('Urlo Assordante', 'Un urlo che indebolisce l''attacco nemico.', 'stato', 'non_comune', 0.95, 0.3, 2, 11, 'debuff_screech', '#C084FC');
INSERT INTO abilities (name, description, category, rarity, target, heal_percent, cooldown, min_level, animation_key, color)
  VALUES ('Secondo Fiato', 'Recupera una parte degli HP massimi.', 'cura', 'comune', 'self', 0.3, 2, 6, 'regen_bloom', '#34D399');
INSERT INTO abilities (name, description, category, rarity, power, accuracy, status_effect, status_chance, min_level, animation_key, color)
  VALUES ('Zanna Velenosa', 'Un morso che può avvelenare il bersaglio.', 'attacco', 'comune', 1.1, 0.95, 'veleno', 0.4, 5, 'venom_spit', '#4ADE80');
INSERT INTO abilities (name, description, category, rarity, power, accuracy, status_effect, status_chance, cooldown, min_level, animation_key, color)
  VALUES ('Colpo Paralizzante', 'Una scarica che può paralizzare il nemico.', 'attacco', 'non_comune', 0.9, 0.95, 'paralisi', 0.45, 1, 10, 'thunder_zap', '#FBBF24');
INSERT INTO abilities (name, description, category, rarity, power, accuracy, cooldown, min_level, animation_key, color)
  VALUES ('Schianto Critico', 'Un attacco preciso e potente.', 'attacco', 'raro', 1.7, 0.9, 2, 18, 'basic_strike', '#94A3B8');
INSERT INTO abilities (name, description, category, rarity, target, buff_def, cooldown, min_level, animation_key, color)
  VALUES ('Danza Elusiva', 'Movimenti eleganti che alzano la difesa.', 'difesa', 'non_comune', 'self', 0.4, 2, 8, 'rock_guard', '#60A5FA');
INSERT INTO abilities (name, description, category, rarity, power, accuracy, hits_min, hits_max, min_level, animation_key, color)
  VALUES ('Sferzata Multipla', 'Una tempesta di colpi: da 3 a 5 attacchi.', 'attacco', 'raro', 0.4, 0.9, 3, 5, 19, 'multi_strike', '#94A3B8');
INSERT INTO abilities (name, description, category, rarity, target, buff_atk, cooldown, min_level, min_rarity, animation_key, color)
  VALUES ('Richiamo Selvaggio', 'Scatena la furia interiore: attacco molto aumentato.', 'potenziamento', 'raro', 'self', 0.5, 3, 23, 'raro', 'buff_roar', '#FBBF24');
INSERT INTO abilities (name, description, category, rarity, power, accuracy, cooldown, min_level, min_rarity, animation_key, color)
  VALUES ('Colpo di Grazia', 'Un colpo poderoso che chiude la lotta.', 'attacco', 'non_comune', 2.0, 0.9, 3, 16, 'non_comune', 'fire_nova', '#F0843C');
INSERT INTO abilities (name, description, category, rarity, power, status_effect, status_chance, debuff_def, cooldown, min_level, animation_key, color)
  VALUES ('Maledizione', 'Marchia il nemico e ne abbassa la difesa.', 'stato', 'raro', 0.3, 'marchio', 1, 0.2, 2, 21, 'shadow_mark', '#F472B6');
INSERT INTO abilities (name, description, category, rarity, target, heal_percent, cooldown, min_level, min_rarity, animation_key, color)
  VALUES ('Rigenerazione Totale', 'Recupera metà degli HP massimi.', 'cura', 'raro', 'self', 0.5, 3, 25, 'raro', 'regen_bloom', '#34D399');

-- ── Fiamma ──────────────────────────────────────────────────────────────────
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, status_effect, status_chance, min_level, allowed_elements, animation_key, color)
  VALUES ('Zanna Ardente', 'Un morso rovente che può scottare.', 'fiamma', 'attacco', 'comune', 1.3, 0.95, 'scottatura', 0.3, 3, ARRAY['fiamma','armonia'], 'fire_slash', '#FB7185');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, status_effect, status_chance, min_level, allowed_elements, animation_key, color)
  VALUES ('Vampata', 'Una fiammata che scotta facilmente il nemico.', 'fiamma', 'attacco', 'non_comune', 1.1, 0.95, 'scottatura', 0.5, 14, ARRAY['fiamma','armonia'], 'fire_slash', '#FB7185');
INSERT INTO abilities (name, description, element, category, rarity, target, buff_def, cooldown, min_level, allowed_elements, animation_key, color)
  VALUES ('Scudo di Brace', 'Un manto di braci che rinforza la difesa.', 'fiamma', 'difesa', 'comune', 'self', 0.35, 2, 7, ARRAY['fiamma','armonia'], 'rock_guard', '#FB7185');
INSERT INTO abilities (name, description, element, category, rarity, power, charge_turns, status_effect, status_chance, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Esplosione Solare', 'Assorbe luce per un turno, poi esplode di fuoco.', 'fiamma', 'attacco', 'raro', 2.8, 1, 'scottatura', 0.3, 3, 30, 'raro', ARRAY['fiamma','armonia'], 'charge_beam', '#FB7185');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, recharge_turns, status_effect, status_chance, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Furia di Magma', 'Un''ondata di magma che richiede recupero.', 'fiamma', 'attacco', 'epico', 2.6, 0.9, 1, 'scottatura', 0.4, 28, 'raro', ARRAY['fiamma','armonia'], 'fire_nova', '#FB7185');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, status_effect, status_chance, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Meteora Infuocata', 'Chiama una meteora incandescente sul nemico.', 'fiamma', 'attacco', 'epico', 2.2, 0.9, 'scottatura', 0.35, 3, 35, 'epico', ARRAY['fiamma','armonia'], 'fire_nova', '#FB7185');

-- ── Adriatico ───────────────────────────────────────────────────────────────
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, min_level, allowed_elements, animation_key, color)
  VALUES ('Getto d''Acqua', 'Un potente getto d''acqua marina.', 'adriatico', 'attacco', 'comune', 1.2, 0.95, 3, ARRAY['adriatico','armonia'], 'water_wave', '#56C8E0');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, hits_min, hits_max, min_level, allowed_elements, animation_key, color)
  VALUES ('Ondata Adriatica', 'Ondate ripetute che travolgono il nemico.', 'adriatico', 'attacco', 'non_comune', 0.7, 0.95, 2, 3, 15, ARRAY['adriatico','armonia'], 'water_wave', '#56C8E0');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, status_effect, status_chance, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Morsa Gelida', 'Acqua gelida che può congelare il bersaglio.', 'adriatico', 'attacco', 'raro', 1.0, 0.95, 'congelamento', 0.3, 1, 24, 'non_comune', ARRAY['adriatico','armonia'], 'frost_shard', '#7DD3FC');
INSERT INTO abilities (name, description, element, category, rarity, target, heal_percent, cooldown, min_level, allowed_elements, animation_key, color)
  VALUES ('Abbraccio della Marea', 'La marea avvolge e cura le ferite.', 'adriatico', 'cura', 'non_comune', 'self', 0.35, 2, 12, ARRAY['adriatico','armonia'], 'regen_bloom', '#56C8E0');
INSERT INTO abilities (name, description, element, category, rarity, power, charge_turns, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Maremoto', 'Raduna un''enorme onda e la scaglia dopo un turno.', 'adriatico', 'attacco', 'raro', 2.7, 1, 3, 30, 'raro', ARRAY['adriatico','armonia'], 'water_spout', '#56C8E0');
INSERT INTO abilities (name, description, element, category, rarity, accuracy, debuff_def, cooldown, min_level, allowed_elements, animation_key, color)
  VALUES ('Nebbia Salmastra', 'Una nebbia che riduce la difesa nemica.', 'adriatico', 'stato', 'non_comune', 0.95, 0.3, 2, 13, ARRAY['adriatico','armonia'], 'debuff_screech', '#56C8E0');

-- ── Bosco ───────────────────────────────────────────────────────────────────
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, min_level, allowed_elements, animation_key, color)
  VALUES ('Frusta di Liane', 'Liane robuste sferzano il nemico.', 'bosco', 'attacco', 'comune', 1.2, 0.95, 3, ARRAY['bosco','armonia'], 'vine_whip', '#34D399');
INSERT INTO abilities (name, description, element, category, rarity, target, self_status, cooldown, min_level, allowed_elements, animation_key, color)
  VALUES ('Radici Curative', 'Radici che rigenerano gli HP nel tempo.', 'bosco', 'cura', 'non_comune', 'self', 'rigenerazione', 3, 10, ARRAY['bosco','armonia'], 'regen_bloom', '#34D399');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, status_effect, status_chance, min_level, allowed_elements, animation_key, color)
  VALUES ('Spore Velenose', 'Spore tossiche che avvelenano il bersaglio.', 'bosco', 'stato', 'non_comune', 0.5, 0.95, 'veleno', 0.6, 11, ARRAY['bosco','armonia'], 'venom_spit', '#4ADE80');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, hits_min, hits_max, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Tempesta di Foglie', 'Foglie taglienti in raffica: 2-4 colpi.', 'bosco', 'attacco', 'raro', 0.5, 0.9, 2, 4, 20, 'non_comune', ARRAY['bosco','armonia'], 'leaf_storm', '#34D399');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, lifesteal_percent, min_level, allowed_elements, animation_key, color)
  VALUES ('Assorbimento', 'Assorbe energia vitale dal nemico.', 'bosco', 'attacco', 'non_comune', 1.0, 0.95, 0.5, 13, ARRAY['bosco','armonia'], 'vine_whip', '#34D399');
INSERT INTO abilities (name, description, element, category, rarity, power, charge_turns, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Furia della Foresta', 'La foresta si carica e travolge il nemico.', 'bosco', 'attacco', 'raro', 2.6, 1, 3, 29, 'raro', ARRAY['bosco','armonia'], 'leaf_storm', '#34D399');
INSERT INTO abilities (name, description, element, category, rarity, accuracy, status_effect, status_chance, cooldown, min_level, allowed_elements, animation_key, color)
  VALUES ('Polline Soporifero', 'Polline che fa addormentare il bersaglio.', 'bosco', 'stato', 'non_comune', 0.9, 'sonno', 0.45, 2, 12, ARRAY['bosco','armonia'], 'venom_spit', '#34D399');

-- ── Terra ───────────────────────────────────────────────────────────────────
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, min_level, allowed_elements, animation_key, color)
  VALUES ('Frana', 'Massi che franano sul nemico.', 'terra', 'attacco', 'comune', 1.4, 0.9, 4, ARRAY['terra','armonia'], 'quake', '#C9A227');
INSERT INTO abilities (name, description, element, category, rarity, target, buff_def, cooldown, min_level, allowed_elements, animation_key, color)
  VALUES ('Scudo di Pietra', 'Una corazza di roccia che alza la difesa.', 'terra', 'difesa', 'comune', 'self', 0.5, 2, 6, ARRAY['terra','armonia'], 'rock_guard', '#C9A227');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, min_level, allowed_elements, animation_key, color)
  VALUES ('Lancia di Roccia', 'Scaglia una lancia di pietra affilata.', 'terra', 'attacco', 'non_comune', 1.3, 0.95, 9, ARRAY['terra','armonia'], 'rock_guard', '#C9A227');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, recharge_turns, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Terremoto', 'Un sisma devastante con un turno di recupero.', 'terra', 'attacco', 'raro', 2.4, 0.9, 1, 27, 'raro', ARRAY['terra','armonia'], 'quake', '#C9A227');
INSERT INTO abilities (name, description, element, category, rarity, accuracy, debuff_atk, debuff_def, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Sabbie Mobili', 'Intrappola il nemico indebolendone attacco e difesa.', 'terra', 'stato', 'raro', 0.95, 0.25, 0.15, 3, 21, 'non_comune', ARRAY['terra','armonia'], 'debuff_screech', '#C9A227');
INSERT INTO abilities (name, description, element, category, rarity, target, buff_atk, buff_def, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Corazza Tellurica', 'La terra rinforza corpo e attacco.', 'terra', 'potenziamento', 'raro', 'self', 0.2, 0.6, 3, 26, 'raro', ARRAY['terra','armonia'], 'rock_guard', '#C9A227');

-- ── Armonia ─────────────────────────────────────────────────────────────────
INSERT INTO abilities (name, description, element, category, rarity, power, min_level, allowed_elements, animation_key, color)
  VALUES ('Onda Armonica', 'Un''onda di energia pura difficile da evitare.', 'armonia', 'attacco', 'non_comune', 1.5, 12, ARRAY['armonia'], 'harmony_beam', '#C084FC');
INSERT INTO abilities (name, description, element, category, rarity, target, heal_percent, buff_atk, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Canto d''Armonia', 'Un canto che cura e rinvigorisce l''attacco.', 'armonia', 'cura', 'raro', 'self', 0.4, 0.25, 3, 22, 'raro', ARRAY['armonia'], 'harmony_heal', '#C084FC');
INSERT INTO abilities (name, description, element, category, rarity, target, self_status, heal_percent, cooldown, min_level, allowed_elements, animation_key, color)
  VALUES ('Eco Curativa', 'Un''eco che innesca una rigenerazione continua.', 'armonia', 'cura', 'non_comune', 'self', 'rigenerazione', 0.2, 3, 15, ARRAY['armonia'], 'harmony_heal', '#C084FC');
INSERT INTO abilities (name, description, element, category, rarity, power, charge_turns, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Sinfonia Distruttrice', 'Accumula energia armonica e la libera devastante.', 'armonia', 'attacco', 'leggendario', 3.0, 1, 3, 38, 'epico', ARRAY['armonia'], 'charge_beam', '#F7C841');
INSERT INTO abilities (name, description, element, category, rarity, power, accuracy, status_effect, status_chance, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Risonanza', 'Vibrazioni che confondono la mente del nemico.', 'armonia', 'attacco', 'raro', 1.2, 0.95, 'confusione', 0.4, 1, 20, 'non_comune', ARRAY['armonia'], 'harmony_beam', '#C084FC');
INSERT INTO abilities (name, description, element, category, rarity, target, buff_atk, buff_def, cooldown, min_level, min_rarity, allowed_elements, animation_key, color)
  VALUES ('Benedizione', 'Un''aura protettiva che potenzia attacco e difesa.', 'armonia', 'potenziamento', 'raro', 'self', 0.3, 0.3, 3, 24, 'raro', ARRAY['armonia'], 'buff_roar', '#C084FC');
