-- Transparent cutout of each creature (no baked background). The immersive
-- battle scene composites this over a per-element background. The sprite
-- resolver falls back to sprite_url / image_url when null, so the app keeps
-- working mid-rollout. The original baked art in image_url is preserved.
ALTER TABLE creatures ADD COLUMN IF NOT EXISTS sprite_cutout_url TEXT;
