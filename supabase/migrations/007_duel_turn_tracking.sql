-- Add turn-based tracking and server-side HP to duels table
ALTER TABLE duels
  ADD COLUMN IF NOT EXISTS current_turn TEXT CHECK (current_turn IN ('challenger', 'opponent')),
  ADD COLUMN IF NOT EXISTS challenger_hp INTEGER,
  ADD COLUMN IF NOT EXISTS opponent_hp INTEGER;
