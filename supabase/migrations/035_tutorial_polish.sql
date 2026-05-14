-- Migration 035 — Tutorial polish before pilot
--
-- 1. Extend items.type CHECK to include 'pozione' and 'cura' (the TS type
--    already exposes them; this aligns the DB constraint so seed inserts
--    don't bounce).
-- 2. Seed a tutorial "Pozione Curativa" (type='cura') in the tutorial
--    shop so the player has an in-combat safety net for the boss fight.
-- 3. Re-point the tutorial boss QR (TUTBSS) at a creature with
--    element='armonia' — armonia is a neutral element with no inherent
--    weakness vs the typical player squad, so the boss is fair regardless
--    of which random comune creatures the player ends up catching. Falls
--    back to the prior comune-any logic if no armonia creature exists.

-- ── 1. Item type constraint ────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_type_check'
  ) THEN
    ALTER TABLE items DROP CONSTRAINT items_type_check;
  END IF;
  ALTER TABLE items
    ADD CONSTRAINT items_type_check
    CHECK (type IN ('rete','esca','uovo','battaglia','pozione','cura'));
END $$;

-- ── 2. Tutorial Pozione Curativa ───────────────────────────────────────────
-- effect_value = 50 → heals 50% of the active creature's max HP when used
-- in combat (matches the rest of the cura catalogue).
INSERT INTO items (id, name, type, effect_value, description, shop_price, session_id, image_url)
VALUES (
  '7470a17e-d41d-0500-0000-000000000112',
  'Pozione del Tirocinante',
  'cura',
  50,
  'Una pozione semplice ma efficace. Ripristina il 50% degli HP della creatura attiva durante un combattimento — utile contro il Capo del Tirocinio.',
  20,
  '7470a101-d41d-0500-0000-000000000001',
  null
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Re-target the tutorial boss to an "armonia" creature ────────────────
DO $$
DECLARE
  preferred_boss_id uuid;
BEGIN
  SELECT id INTO preferred_boss_id
  FROM creatures
  WHERE spawnable = true
    AND element = 'armonia'
    AND rarity IN ('comune', 'non_comune')
  ORDER BY rarity ASC, created_at ASC
  LIMIT 1;

  -- Fall back to ANY spawnable comune if no armonia is available — better
  -- to have a slightly-unfair boss than no boss at all.
  IF preferred_boss_id IS NULL THEN
    SELECT id INTO preferred_boss_id
    FROM creatures
    WHERE spawnable = true AND rarity = 'comune'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF preferred_boss_id IS NOT NULL THEN
    UPDATE qr_codes
    SET payload = jsonb_build_object(
      'creatures', jsonb_build_array(
        jsonb_build_object('creature_id', preferred_boss_id, 'level_override', 3)
      ),
      'reward', jsonb_build_object('gold', 300, 'exp', 100)
    )
    WHERE id = '7470a1c0-d41d-0500-0000-000000000220';
  END IF;
END $$;
