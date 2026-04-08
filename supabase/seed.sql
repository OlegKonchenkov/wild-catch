-- ============================================================
-- Seed Data: Starter Items + 31 Creatures
-- ============================================================

-- ------------------------------------------------------------
-- Items (6 starter items)
-- NOTE: item type must be one of: 'rete','esca','uovo','battaglia'
-- Sfere → 'rete' (capture nets), Pozioni → 'battaglia' (battle items)
-- ------------------------------------------------------------
INSERT INTO items (id, name, description, type, effect_value, shop_price) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Rete Base',       'Una rete per catturare creature comuni.',         'rete',      1,  10),
  ('00000000-0000-0000-0000-000000000002', 'Rete Superiore',  'Migliore tasso di cattura.',                     'rete',      2,  25),
  ('00000000-0000-0000-0000-000000000003', 'Rete Master',     'Cattura qualsiasi creatura.',                    'rete',      5, 100),
  ('00000000-0000-0000-0000-000000000004', 'Pozione',         'Ripristina 30 HP durante un combattimento.',     'battaglia', 30,  15),
  ('00000000-0000-0000-0000-000000000005', 'Super Pozione',   'Ripristina 80 HP durante un combattimento.',     'battaglia', 80,  40),
  ('00000000-0000-0000-0000-000000000006', 'Esca Profumata',  'Attira creature rare per 5 minuti.',             'esca',       5,  50)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Creatures (30 total — Italian/Adriatic/woodland themed)
--
-- Distribution:
--   Rarity   : 12 comune, 8 non_comune, 5 raro, 3 epico, 2 leggendario
--   Element  : fiamma(6), adriatico(8), bosco(8), terra(5), armonia(3)
--   HP ranges: comune 30-60, non_comune 60-90, raro 90-120,
--              epico 120-160, leggendario 160-200
--   spawn_weight: comune 20-30, non_comune 10-15, raro 5-8,
--                 epico 2-3, leggendario 1
--
-- Evolution chains (base creature inserted first):
--   Chain A: Embris  (00000000-0000-0000-0001-000000000001)
--         →  Volcino (00000000-0000-0000-0001-000000000002)
--   Chain B: Ondina  (00000000-0000-0000-0001-000000000003)
--         →  Marestella (00000000-0000-0000-0001-000000000004)
--   Chain C: Foglino (00000000-0000-0000-0001-000000000005)
--         →  Quercino   (00000000-0000-0000-0001-000000000006)
--   Chain D: Sassetto (00000000-0000-0000-0001-000000000007)
--         →  Petroso    (00000000-0000-0000-0001-000000000008)
-- ------------------------------------------------------------

-- ===== BASE CREATURES OF EVOLUTION CHAINS (inserted first) =====

-- Chain A base: Embris (fiamma, comune)
INSERT INTO creatures (id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight)
VALUES (
  '00000000-0000-0000-0001-000000000001',
  'Embris',
  'Una piccola fiamma vivente che danza tra i sassi caldi della riviera adriatica.',
  'fiamma', 'comune', 38, 12, 6, 1, 28
) ON CONFLICT (id) DO NOTHING;

-- Chain B base: Ondina (adriatico, comune)
INSERT INTO creatures (id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight)
VALUES (
  '00000000-0000-0000-0001-000000000003',
  'Ondina',
  'Spiritello acquatico che gioca tra le onde basse della costa adriatica.',
  'adriatico', 'comune', 42, 10, 8, 1, 26
) ON CONFLICT (id) DO NOTHING;

-- Chain C base: Foglino (bosco, comune)
INSERT INTO creatures (id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight)
VALUES (
  '00000000-0000-0000-0001-000000000005',
  'Foglino',
  'Creatura fogliosa che si mimetizza perfettamente tra le foglie autunnali.',
  'bosco', 'comune', 35, 9, 7, 1, 30
) ON CONFLICT (id) DO NOTHING;

-- Chain D base: Sassetto (terra, comune)
INSERT INTO creatures (id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight)
VALUES (
  '00000000-0000-0000-0001-000000000007',
  'Sassetto',
  'Piccolo elementale di pietra che rotola lungo i sentieri di ghiaia.',
  'terra', 'comune', 40, 8, 12, 1, 25
) ON CONFLICT (id) DO NOTHING;

-- ===== EVOLVED FORMS =====

-- Chain A evolved: Volcino (fiamma, non_comune)
INSERT INTO creatures (id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight, evolution_of)
VALUES (
  '00000000-0000-0000-0001-000000000002',
  'Volcino',
  'Embris cresciuto, il suo corpo irradia calore intenso e lascia tracce bruciate.',
  'fiamma', 'non_comune', 72, 22, 12, 1, 12,
  '00000000-0000-0000-0001-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- Chain B evolved: Marestella (adriatico, non_comune)
INSERT INTO creatures (id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight, evolution_of)
VALUES (
  '00000000-0000-0000-0001-000000000004',
  'Marestella',
  'Ondina evoluta che cavalca le onde come una stella marina danzante.',
  'adriatico', 'non_comune', 78, 20, 14, 1, 11,
  '00000000-0000-0000-0001-000000000003'
) ON CONFLICT (id) DO NOTHING;

-- Chain C evolved: Quercino (bosco, non_comune)
INSERT INTO creatures (id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight, evolution_of)
VALUES (
  '00000000-0000-0000-0001-000000000006',
  'Quercino',
  'Foglino che ha assorbito la forza di una vecchia quercia del bosco appenninico.',
  'bosco', 'non_comune', 75, 18, 18, 1, 12,
  '00000000-0000-0000-0001-000000000005'
) ON CONFLICT (id) DO NOTHING;

-- Chain D evolved: Petroso (terra, raro)
INSERT INTO creatures (id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight, evolution_of)
VALUES (
  '00000000-0000-0000-0001-000000000008',
  'Petroso',
  'Sassetto che si è indurito nel tempo, diventando un guardiano di pietra delle colline.',
  'terra', 'raro', 98, 24, 30, 1, 6,
  '00000000-0000-0000-0001-000000000007'
) ON CONFLICT (id) DO NOTHING;

-- ===== REMAINING COMUNE (8 more, total 12) =====

INSERT INTO creatures (name, description, element, rarity, hp, atk, def, min_level, spawn_weight) VALUES
  ('Focoletto',
   'Minuscolo spirito del fuoco che abita i camini delle vecchie case di campagna.',
   'fiamma', 'comune', 32, 10, 5, 1, 27),

  ('Bragola',
   'Creatura fiammante che scintilla come braci di un falò sulla spiaggia.',
   'fiamma', 'comune', 36, 11, 4, 1, 24),

  ('Corallino',
   'Piccolo essere che vive tra i coralli colorati del fondale adriatico.',
   'adriatico', 'comune', 44, 9, 9, 1, 25),

  ('Medusello',
   'Medusa in miniatura, innocua ma capace di produrre lievi scosse elettriche.',
   'adriatico', 'comune', 38, 13, 4, 1, 22),

  ('Radicello',
   'Radice animata che si muove sotto terra e affiora solo di notte.',
   'bosco', 'comune', 33, 8, 10, 1, 28),

  ('Muschio',
   'Soffice creatura di muschio che prospera nei boschi umidi delle Marche.',
   'bosco', 'comune', 30, 7, 11, 1, 29),

  ('Argillina',
   'Piccolo golem di argilla formato dalle rive dei fiumi appenninici.',
   'terra', 'comune', 45, 8, 13, 1, 23),

  ('Paceverde',
   'Creatura di puro equilibrio che porta armonia dove passa.',
   'armonia', 'comune', 40, 9, 9, 1, 20)
ON CONFLICT DO NOTHING;

-- ===== NON_COMUNE (5 more, total 8) =====

INSERT INTO creatures (name, description, element, rarity, hp, atk, def, min_level, spawn_weight) VALUES
  ('Pirostrega',
   'Strega delle fiamme che danza nei boschi la notte di San Giovanni.',
   'fiamma', 'non_comune', 80, 26, 10, 1, 13),

  ('Algario',
   'Guardiano delle alghe profonde, conosce i segreti del fondale adriatico.',
   'adriatico', 'non_comune', 82, 21, 16, 1, 11),

  ('Tempestino',
   'Spirito delle tempeste marine, cavalca le onde durante le burrasche.',
   'adriatico', 'non_comune', 68, 28, 8, 1, 14),

  ('Fungoppo',
   'Fungo gigante animato che sparge spore luminose nei boschi notturni.',
   'bosco', 'non_comune', 76, 19, 15, 1, 12),

  ('Spinoso',
   'Creatura coperta di spine acuminate che presidia i cespugli di rovo.',
   'bosco', 'non_comune', 65, 24, 14, 1, 14)
ON CONFLICT DO NOTHING;

-- ===== RARO (4 more, total 5) =====

INSERT INTO creatures (name, description, element, rarity, hp, atk, def, min_level, spawn_weight) VALUES
  ('Pescluce',
   'Pesce abissale luminescente che risale dal profondo solo nelle notti senza luna.',
   'adriatico', 'raro', 100, 30, 20, 1, 7),

  ('Abissolo',
   'Creatura delle profondità, nata nelle fosse più scure dell Adriatico.',
   'adriatico', 'raro', 108, 32, 22, 1, 5),

  ('Rampicante',
   'Vite selvaggia animata che avvolge gli alberi più alti del bosco.',
   'bosco', 'raro', 95, 28, 24, 1, 6),

  ('Nocciolo',
   'Antico spirito del nocciolo selvatico, custode dei boschi collinari.',
   'bosco', 'raro', 112, 26, 28, 1, 5)
ON CONFLICT DO NOTHING;

-- ===== EPICO (3 total) =====

INSERT INTO creatures (name, description, element, rarity, hp, atk, def, min_level, spawn_weight) VALUES
  ('Incendino',
   'Drago di fuoco minore che sorvola i vulcani sottomarini dell Adriatico meridionale.',
   'fiamma', 'epico', 145, 45, 28, 1, 3),

  ('Fangolo',
   'Colosso di fango primordiale formatosi nei delta dei grandi fiumi padani.',
   'terra', 'epico', 152, 38, 42, 1, 2),

  ('Equilibrio',
   'Essere di pura armonia nato dall incontro tra mare, terra e cielo.',
   'armonia', 'epico', 138, 40, 35, 1, 2)
ON CONFLICT DO NOTHING;

-- ===== LEGGENDARIO (2 total) =====

INSERT INTO creatures (name, description, element, rarity, hp, atk, def, min_level, spawn_weight) VALUES
  ('Armovolo',
   'Leggendario signore dei cieli adriatici, la cui presenza porta pace e prosperità alle coste.',
   'armonia', 'leggendario', 185, 55, 50, 1, 1),

  ('Miniera',
   'Spirito primordiale della terra che dorme nelle profondità delle Apennini da millenni.',
   'terra', 'leggendario', 200, 60, 55, 1, 1)
ON CONFLICT DO NOTHING;
-- ===== MITOLOGICO (1 total) =====

INSERT INTO creatures (id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight) VALUES
  ('00000000-0000-0000-0001-000000000031',
   'Miraluna',
   'Creatura mitologica che appare solo quando la luna si riflette perfettamente sull Adriatico in silenzio assoluto.',
   'armonia', 'mitologico', 225, 68, 62, 1, 1)
ON CONFLICT (id) DO NOTHING;
