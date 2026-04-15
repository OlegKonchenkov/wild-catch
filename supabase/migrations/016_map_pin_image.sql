-- Migration 016 — Add image_url to session_map_pins
--
-- Allows admins to attach an image to a map pin.
-- The image is stored in the Supabase Storage 'uploads' bucket
-- and displayed in the pin popup on the game map.

ALTER TABLE session_map_pins ADD COLUMN IF NOT EXISTS image_url TEXT;
