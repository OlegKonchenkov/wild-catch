-- Migration 070 — Evoluzione GOLD (Wave 3).
--
-- Alla 3ª copia di un Daimon il giocatore può forgiarne la variante GOLD:
-- consuma 2 copie + 25 gemme → is_gold = true. Bonus: +10% delle stats base,
-- applicato in getEquipmentBonuses (vale per tutti i combat mode).

ALTER TABLE player_creatures
  ADD COLUMN IF NOT EXISTS is_gold BOOLEAN NOT NULL DEFAULT FALSE;
