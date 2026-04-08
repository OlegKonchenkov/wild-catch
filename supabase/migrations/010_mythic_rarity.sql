ALTER TABLE creatures DROP CONSTRAINT IF EXISTS creatures_rarity_check;
ALTER TABLE creatures
  ADD CONSTRAINT creatures_rarity_check
  CHECK (rarity IN ('comune','non_comune','raro','epico','leggendario','mitologico'));

INSERT INTO creatures (
  id, name, description, element, rarity, hp, atk, def, min_level, spawn_weight
)
VALUES (
  '00000000-0000-0000-0001-000000000031',
  'Miraluna',
  'Creatura mitologica che appare solo quando la luna si riflette perfettamente sull Adriatico in silenzio assoluto.',
  'armonia',
  'mitologico',
  225,
  68,
  62,
  1,
  1
)
ON CONFLICT (id) DO NOTHING;
